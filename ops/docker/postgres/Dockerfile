FROM postgres:16-alpine

RUN apk add --no-cache --virtual .build-deps \
    build-base \
    git \
    postgresql16-dev \
  && git clone --branch v5.1.1 --depth 1 https://github.com/pgpartman/pg_partman.git /tmp/pg_partman \
  && cd /tmp/pg_partman \
  && make \
  && make install \
  && cd / \
  && rm -rf /tmp/pg_partman \
  && apk del .build-deps
