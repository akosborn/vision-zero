# Vision Zero Denver

Denver crash analysis and mapping backed by PostgreSQL/PostGIS, Next.js,
Mapbox, and Metabase.

## Project Documentation

- [Architecture overview](ARCHITECTURE.md)
- [Prioritized TODO checklist](TODO.md)
- [Next.js application notes](nextjs/README.md)

Application code and commands live in `nextjs/`. Database import and schema work
live in `data/`. Never commit local `.env` files or database credentials.

## Operations

### Renewing SSL Cert

Ultimately, I should automate this with a cron job, but for now:

```shell
docker run --rm -it \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  --webroot-path /var/www/certbot \
  -d denver.zerovision.dev -d www.denver.zerovision.dev \
  --email my-email@gmail.com --agree-tos --no-eff-email && \
  docker compose exec nginx nginx -s reload
```

### Restoring the PostGIS Container

`compose.yaml` uses the `postgis/postgis:17-3.4` image, so PostGIS should not be
installed manually inside a running container. Recreate the `postgres` service
from the declared image while preserving the named `postgres_data` volume:

```bash
docker compose pull postgres
docker compose up -d --force-recreate postgres
```

Back up or snapshot material database data before changing the image, volume, or
schema. Do not delete the `postgres_data` volume as part of routine recovery.
