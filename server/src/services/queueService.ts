import Queue from "better-queue";
import path from "path";
import { logger } from "../utils/logger.js";

const storagePath = process.env.STORAGE_PATH ?? "./storage";
const queueDir = path.join(storagePath, "queue");

export interface PublishJob {
  id: string;
  notionPageId: string;
  platforms: string[];
  scheduledAt: string;
  createdAt: string;
}

type JobHandler = (job: PublishJob) => Promise<void>;

let publishQueue: Queue | null = null;

export function createPublishQueue(handler: JobHandler): Queue {
  publishQueue = new Queue(
    async (job: PublishJob, done: (err?: Error) => void) => {
      try {
        logger.info(`Processing publish job: ${job.id}`, {
          notionPageId: job.notionPageId,
          platforms: job.platforms,
        });
        await handler(job);
        done();
      } catch (err: any) {
        logger.error(`Publish job failed: ${job.id}`, { error: err.message });
        done(err);
      }
    },
    {
      concurrent: 1,
      maxRetries: 3,
      retryDelay: 5000,
      store: {
        type: "sql",
        dialect: "sqlite",
        path: path.join(queueDir, "jobs.db"),
      } as any,
    }
  );

  publishQueue.on("task_finish", (taskId: string) => {
    logger.info(`Publish job completed: ${taskId}`);
  });

  publishQueue.on("task_failed", (taskId: string, err: Error) => {
    logger.error(`Publish job permanently failed: ${taskId}`, {
      error: err.message,
    });
  });

  return publishQueue;
}

export function enqueuePublishJob(job: PublishJob): void {
  if (!publishQueue) {
    throw new Error("Queue not initialized. Call createPublishQueue first.");
  }
  publishQueue.push(job);
  logger.info(`Enqueued publish job: ${job.id}`);
}
