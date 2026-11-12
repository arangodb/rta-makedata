#!/usr/bin/env bash
# Shared driver for the makedata / checkdata / cleardata / waitdata wrappers.
# Mirrors rtaMakedata() in arangodb's
# js/client/modules/@arangodb/testutils/client-tools.js
#
# Usage: <wrapper> [wrapper options] [DATABASE] [makedata options] [-- makedata options]
#
# Wrapper options (consumed here):
#   --build DIR             arangodb build directory containing bin/arangosh
#   --arangodb-src DIR      arangodb source tree (js/, etc/testing/arangosh.conf);
#                           searched upwards from the directory the wrapper was
#                           invoked from (a symlink's location counts), then from
#                           the real rta-makedata checkout, then from the cwd
#   --one-shard             --singleShard true --createOneShardDatabase true --countOffset 1
#   --dry-run               print the arangosh command line instead of running it
#   -h | --help             show this help
#
# Options containing a '.' (e.g. --server.endpoint, --server.password, --log.level)
# are passed on to arangosh. --server.password is also handed to the script
# as --passvoid. Every other option goes to the javascript file, e.g.
#   --test 100,400   --skip 020   --minReplicationFactor 2   --oldVersion 3.12.4
# The first non-option argument is the database (defaults to _system); put it
# before options that take no value, so it is not mistaken for their value.
#
# Environment: ARANGOSH overrides the arangosh binary to use.
#
# Examples:
#   scripts/makedata --server.endpoint tcp://127.0.0.1:8529
#   scripts/checkdata --server.endpoint tcp://127.0.0.1:8529 --test 100
#   scripts/cleardata --build ../../build-ee --server.password secret system_foo


# follow a (chain of) symlink(s) to the real file; no readlink -f on macOS
rta_resolve () {
    local p="$1" t
    while [ -L "$p" ]; do
        t="$(readlink "$p")"
        case "$t" in
            /*) p="$t";;
            *) p="$(dirname "$p")/$t";;
        esac
    done
    echo "$(cd -P "$(dirname "$p")" && pwd -P)/$(basename "$p")"
}

# walk up from $1 until a directory looks like an arangodb source tree
rta_find_arangodb_src () {
    local d
    d="$(cd "$1" 2>/dev/null && pwd)" || return 1
    while [ -n "$d" ]; do
        if [ -f "$d/etc/testing/arangosh.conf" ] && [ -d "$d/js/client" ]; then
            echo "$d"
            return 0
        fi
        [ "$d" = "/" ] && break
        d="$(dirname "$d")"
    done
    return 1
}

# $1: mode (makedata / checkdata / cleardata / waitdata)
# $2: path the wrapper was invoked by, possibly a symlink
rta_main () {
    local mode="$1"; shift
    local invoked="$1"; shift

    local PS='/'
    local EXT=""
    if test -n "$ORIGINAL_PATH"; then
        # running in cygwin...
        PS='\'
        EXT=".exe"
    fi

    # INVOKE_DIR: where the wrapper (or a symlink to it) was called from;
    # RTA_DIR: the real rta-makedata checkout, all symlinks resolved.
    local INVOKE_DIR RTA_DIR
    INVOKE_DIR="$(cd "$(dirname "$invoked")" && pwd)"
    RTA_DIR="$(dirname "$(dirname "$(rta_resolve "${BASH_SOURCE[0]}")")")"

    local BUILD_DIR=""
    local ARANGODB_SRC=""
    local DATABASE="_system"
    local HAVE_DATABASE=0
    local DRY_RUN=0
    local WANT_HELP=0
    local HAVE_OLD_VERSION=0
    local -a SH_ARGS=()
    local -a JS_ARGS=()

    while [ $# -gt 0 ]; do
        case "$1" in
            --build) BUILD_DIR="$2"; shift 2; continue;;
            --build=*) BUILD_DIR="${1#*=}"; shift; continue;;
            --arangodb-src) ARANGODB_SRC="$2"; shift 2; continue;;
            --arangodb-src=*) ARANGODB_SRC="${1#*=}"; shift; continue;;
            --one-shard)
                JS_ARGS+=(--singleShard true --createOneShardDatabase true --countOffset 1)
                shift; continue;;
            --dry-run) DRY_RUN=1; shift; continue;;
            -h|--help)
                # wrapper options first, the script's own ones follow once arangosh is located
                sed -n '2,/^$/p' "${BASH_SOURCE[0]}" | sed -e 's/^# \{0,1\}//' -e "s;<wrapper>;$(basename "$0");"
                WANT_HELP=1; shift; continue;;
            --) shift; JS_ARGS+=("$@"); break;;
        esac

        local opt="$1" val="" has_val=0
        shift
        if [[ "$opt" == --*=* ]]; then
            val="${opt#*=}"; opt="${opt%%=*}"; has_val=1
        elif [[ "$opt" == -* ]] && [ $# -gt 0 ] && [[ "$1" != -* ]]; then
            val="$1"; shift; has_val=1
        fi

        if [[ "$opt" != -* ]]; then
            if [ "$HAVE_DATABASE" -eq 1 ]; then
                echo "$0: unexpected argument '$opt'" >&2
                exit 2
            fi
            DATABASE="$opt"; HAVE_DATABASE=1
        elif [[ "$opt" == *.* ]]; then
            SH_ARGS+=("$opt")
            [ "$has_val" -eq 1 ] && SH_ARGS+=("$val")
            if [ "$opt" = "--server.password" ]; then
                JS_ARGS+=(--passvoid "$val")
            fi
        else
            [ "$opt" = "--oldVersion" ] && HAVE_OLD_VERSION=1
            JS_ARGS+=("$opt")
            [ "$has_val" -eq 1 ] && JS_ARGS+=("$val")
        fi
    done

    # locate the arangodb source tree: first above the place we were invoked
    # from (i.e. where a symlink to the wrapper lives), then above the real
    # rta-makedata checkout (3rdParty/ submodule), then above the cwd.
    if [ -z "$ARANGODB_SRC" ]; then
        ARANGODB_SRC="$(rta_find_arangodb_src "$INVOKE_DIR")" ||
        ARANGODB_SRC="$(rta_find_arangodb_src "$RTA_DIR")" ||
        ARANGODB_SRC="$(rta_find_arangodb_src "$(pwd)")" ||
        ARANGODB_SRC=""
    elif [ ! -f "${ARANGODB_SRC}/etc/testing/arangosh.conf" ]; then
        echo "$0: --arangodb-src '${ARANGODB_SRC}' has no etc/testing/arangosh.conf" >&2
        exit 2
    fi
    if [ -n "$ARANGODB_SRC" ]; then
        ARANGODB_SRC="$(cd "$ARANGODB_SRC" && pwd)"
    fi

    # locate arangosh the same way scripts/unittest does
    if [ -z "${ARANGOSH}" ]; then
        local candidate
        for candidate in \
            "${BUILD_DIR:+${BUILD_DIR}/bin/arangosh${EXT}}" \
            "${ARANGODB_SRC:+${ARANGODB_SRC}/build/bin/arangosh${EXT}}" \
            "build/bin/arangosh${EXT}" \
            "bin/arangosh${EXT}" \
            "usr/bin/arangosh${EXT}"; do
            if [ -n "$candidate" ] && [ -x "$candidate" ] && [ ! -d "$candidate" ]; then
                ARANGOSH="$(cd "$(dirname "$candidate")" && pwd)/$(basename "$candidate")"
                break
            fi
        done
        if [ -z "${ARANGOSH}" ]; then
            ARANGOSH="$(command -v "arangosh${EXT}")" || {
                if [ "$WANT_HELP" -eq 1 ]; then
                    echo "(cannot locate arangosh to list the options of ${mode}.js)" >&2
                    exit 0
                fi
                echo "$0: cannot locate arangosh, use --build or set ARANGOSH" >&2
                exit 1
            }
            echo "WARNING: Using arangosh from PATH: $ARANGOSH" >&2
        fi
    fi

    local -a BASE_ARGS=(--console.colors false --quiet)
    local RUN_DIR="$RTA_DIR"
    if [ -n "$ARANGODB_SRC" ]; then
        # run from within the source tree so the relative paths of the testing config resolve
        RUN_DIR="$ARANGODB_SRC"
        BASE_ARGS=(
            -c "etc${PS}testing${PS}arangosh.conf"
            --javascript.startup-directory "js"
            --javascript.module-directory "enterprise${PS}js"
            "${BASE_ARGS[@]}"
        )
    fi

    if [ "$WANT_HELP" -eq 1 ]; then
        echo
        echo "Options of ${mode}.js:"
        # arangosh reports a process.exit(0) before the end of a script as
        # failure (exit code 1), so its exit code is meaningless here
        (cd "$RUN_DIR" && "$ARANGOSH" "${BASE_ARGS[@]}" \
             --server.endpoint none --log.level warning \
             --javascript.execute "${RTA_DIR}${PS}test_data${PS}${mode}.js" -- --help)
        exit 0
    fi

    # rtaMakedata() pins oldVersion to the version makedata ran against;
    # without an upgrade in between that is the current server version.
    if [ "$HAVE_OLD_VERSION" -eq 0 ] && [ "$DRY_RUN" -eq 0 ]; then
        local version
        version="$(cd "$RUN_DIR" && "$ARANGOSH" "${BASE_ARGS[@]}" "${SH_ARGS[@]}" \
                     --log.level warning \
                     --javascript.execute-string 'print("VERSION=" + db._version())' 2>/dev/null \
                   | sed -n 's/^VERSION=\([0-9][^[:space:]]*\)$/\1/p' | tail -n 1)"
        if [ -z "$version" ]; then
            echo "$0: failed to query the server version, is the server reachable?" >&2
            exit 1
        fi
        JS_ARGS+=(--oldVersion "$version")
    fi

    local -a CMD=(
        "$ARANGOSH"
        "${BASE_ARGS[@]}"
        --log.level warning --log.level httpclient=debug --log.level V8=debug
        "${SH_ARGS[@]}"
        --javascript.execute "${RTA_DIR}${PS}test_data${PS}${mode}.js"
        --
        "$DATABASE"
        --progress true
        --printTimeTableMeasurement true
        "${JS_ARGS[@]}"
    )

    if [ "$DRY_RUN" -eq 1 ]; then
        (cd "$RUN_DIR" && printf '%q ' "${CMD[@]}"; echo)
        exit 0
    fi
    cd "$RUN_DIR" && exec "${CMD[@]}"
}
