import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  FCM_PROJECT_ID: Joi.string().required(),
  FCM_CLIENT_EMAIL: Joi.string().required(),
  FCM_PRIVATE_KEY: Joi.string().required(),
  SENTRY_DSN: Joi.string().required(),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
});
