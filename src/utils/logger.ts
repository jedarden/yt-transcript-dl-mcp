import winston from 'winston';
import { ServerConfig } from '../types';

export class Logger {
  private static instance: winston.Logger;

  public static getInstance(config?: ServerConfig['logging']): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: config?.level || 'info',
        format: config?.format === 'json' 
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json()
            )
          : winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.simple()
            ),
        transports: [
          new winston.transports.Console(),
          new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
          }),
          new winston.transports.File({ 
            filename: 'logs/combined.log' 
          })
        ],
      });
    }
    return Logger.instance;
  }

  public static debug(message: string, meta?: any): void {
    Logger.getInstance().debug(message, meta);
  }

  public static info(message: string, meta?: any): void {
    Logger.getInstance().info(message, meta);
  }

  public static warn(message: string, meta?: any): void {
    Logger.getInstance().warn(message, meta);
  }

  public static error(message: string, meta?: any): void {
    Logger.getInstance().error(message, meta);
  }
}

export default Logger;