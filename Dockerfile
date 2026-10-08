FROM node:24-alpine

# tini fa da PID 1: senza, node ignora SIGTERM e "docker stop" aspetta 10s
# prima di uccidere il processo.
RUN apk add --no-cache tini

WORKDIR /app
COPY server.js hellgalaxy.html VERSION ./
COPY scripts/migrate_to_db.js scripts/migrate_enemies_to_db.js scripts/migrate_entities_to_db.js scripts/sheet_mappings.js scripts/unreal_bridge.js scripts/unreal_read.js scripts/entity_effective.js scripts/modules_sheet.js scripts/tabs_sheet.js scripts/tabs_server.js scripts/grid_tabs.js ./scripts/
COPY scripts/unreal/entities_read.py scripts/unreal/modules_read.py scripts/unreal/tabs_read.py ./scripts/unreal/

# Dati sorgente e immagini iniziali. Stanno in /seed e non sotto /app perche'
# server.js serve staticamente tutto quello che trova sotto /app, e i volumi
# montati su /app/data e /app/images nasconderebbero comunque questi file.
COPY data/ /seed/data/
COPY images/ /seed/images/

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
 && chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /app/data /app/images \
 && chown -R node:node /app

USER node
EXPOSE 8936

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8936/images/logo.svg || exit 1

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
