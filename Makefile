.PHONY: up down logs logs-app logs-worker ps shell-app shell-db clean

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

logs-app:
	docker compose logs -f task-platform

logs-worker:
	docker compose logs -f reminder-worker

ps:
	docker compose ps

shell-app:
	docker compose exec task-platform sh

shell-db:
	docker compose exec postgres psql -U taskplatform -d taskplatform

clean:
	docker compose down -v
