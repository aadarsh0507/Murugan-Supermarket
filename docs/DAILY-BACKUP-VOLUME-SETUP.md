# Daily backup in MySQL container volume

Daily backup runs at **1 PM** and saves `backup-YYYY-MM-DD.sql` inside the MySQL container. For it to be stored in a **persistent volume**, do the following.

## Required setup

### 1. MySQL container must mount the backup volume

The container that runs your client DB (e.g. `mysql8`) must have a volume mounted at `/backups`.

**Using this repo's docker-compose** (recommended):

```bash
cd D:\Frontend\Super_Market
docker compose up -d db
```

The `db` service in `docker-compose.yml` already has:

- `container_name: mysql8`
- `volumes: mysql_backups:/backups`
- Volume `mysql_backups` defined at the bottom

So backups will be written to `/backups` inside the container and persist in the `mysql_backups` volume.

**If you run MySQL another way**, add a mount for backups, for example:

- Docker run: `-v mysql_backups:/backups`
- Or create the volume first: `docker volume create mysql_backups`, then use it in your compose/run.

### 2. Environment variables (.env)

| Variable | Required | Example | Purpose |
|----------|----------|---------|--------|
| `MYSQL_URL` | Yes | `mysql://root:market_2025@localhost:3306/Super_Market` | Client DB (source of backup). |
| `BACKUP_VOLUME_PATH` | Yes | `/backups` | Path inside the MySQL container where backup is written (must be the volume mount). |
| `MYSQL_BACKUP_CONTAINER` | No | `mysql8` | Container name (default: `mysql8`). Must match the container that runs the DB in `MYSQL_URL`. |
| `BACKUP_TZ` | No | `Asia/Kolkata` | Timezone for 1 PM (default: Asia/Kolkata). |

### 3. Backend must be able to run `docker exec`

The backup job runs `docker exec mysql8 mysqldump ...`. So:

- Backend process must run on the **same host** as Docker (e.g. `npm run dev` on your PC, or backend container with Docker socket mounted).
- The container name must match `MYSQL_BACKUP_CONTAINER` (e.g. `mysql8`).

## One-time: apply the volume to your MySQL container

If your current `mysql8` was started **without** the backup volume:

1. Stop and remove the existing container (export data first if needed):
   ```powershell
   docker stop mysql8
   docker rm mysql8
   ```
2. Start MySQL from this project so it gets the volume:
   ```powershell
   cd D:\Frontend\Super_Market
   docker compose up -d db
   ```
3. Confirm the mount:
   ```powershell
   docker exec mysql8 ls -la /backups
   ```
   You should see an empty directory (or existing backup files). After 1 PM you should see `backup-YYYY-MM-DD.sql`.

## Verify after 1 PM

```powershell
docker exec mysql8 ls -la /backups
```

You should see today’s file, e.g. `backup-2026-02-22.sql`.

## Optional: run backup manually (same path as daily job)

From the backend directory (or with `MYSQL_URL` and `BACKUP_VOLUME_PATH` set):

```powershell
cd backend
node -e "import('./jobs/dailyBackup.js').then(m => m.runDailyBackup())"
```

Then check again: `docker exec mysql8 ls -la /backups`.
