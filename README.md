## Renewing SSL Cert

1. Disable the https redirects in `nginx.config`
2. Rebuild the nginx container: `docker compose build nginx`
3. Restart the nginx container: `docker compose restart nginx`
4. Run `docker run --rm -it   -v "$(pwd)/certbot/conf:/etc/letsencrypt"   -v "$(pwd)/certbot/www:/var/www/certbot"   certbot/certbot certonly   --webroot   --webroot-path /var/www/certbot   -d denver.zerovision.dev -d www.denver.zerovision.dev   --email email-address-here --agree-tos --no-eff-email`
5. Re-enable https redirects in `nginx.config`
6. Rebuild the nginx container: `docker compose build nginx`
7. Restart the nginx container: `docker compose restart nginx`

## Reenabling PostGIS After Container Deletion

1. Connect to the container `docker exec -it postgres17 bash`
2. Install the postgis libary: `apt-get install -y postgis postgresql-17-postgis-3`

### Long-Term Solution

1. Migrate the Docker image to `postgis/postgis:17-3.4`
