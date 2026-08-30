# Pinned (not :latest): an unpinned emsdk silently drifts to whatever Emscripten ships that day,
# which has broken this build before (removed -s EXTRA_EXPORTED_RUNTIME_METHODS, changed emcc's
# default C/C++ linkage - see CMakeLists.txt). Bump deliberately, and re-run the full build to
# confirm CMakeLists.txt's EMCC_ARGS/em++ usage still matches whatever version you bump to.
FROM emscripten/emsdk:6.0.8
ENV PYTHONUNBUFFERED 1
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
          libgeos-dev ed \
          automake autoconf libtool \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir code
WORKDIR /code
