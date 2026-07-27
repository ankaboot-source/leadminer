import logger from './logger';

export function assertNotProduction(): void {
  // Lazy import to avoid circular deps — logger imports config, errors imports logger
  if (process.env.NODE_ENV === 'production') {
    logger.error('sms-gateway-mock must not run in production');
    throw new Error('sms-gateway-mock must not run in production');
  }
}

export default assertNotProduction;
