/**
 * Centralized Configuration Management
 * 
 * All environment variables are loaded and validated here.
 * Provides a single source of truth for application configuration.
 */

require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Download/Upload Limits
  maxDownloadSizeMB: parseInt(process.env.MAX_DOWNLOAD_SIZE_MB || '50', 10),
  maxUploadSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10),
  
  // Rate Limiting
  rateLimit: {
    enabled: (process.env.ENABLE_RATE_LIMIT || 'true').toLowerCase() === 'true',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '120', 10),
  },
  
  // Circuit Breaker
  maxInflightRequests: parseInt(process.env.MAX_INFLIGHT_REQUESTS || '100', 10),
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Metrics
  metrics: {
    enabled: (process.env.ENABLE_METRICS || 'true').toLowerCase() === 'true',
  },
  
  // Server Location
  serverLocation: process.env.SERVER_LOCATION || 'EU WEST (Amsterdam, Netherlands)',
};

// Validation
const validateConfig = (cfg) => {
  const errors = [];
  
  if (cfg.port < 1 || cfg.port > 65535) {
    errors.push(`Invalid PORT: ${cfg.port}. Must be between 1 and 65535.`);
  }
  
  if (cfg.maxDownloadSizeMB < 1 || cfg.maxDownloadSizeMB > 1000) {
    errors.push(`Invalid MAX_DOWNLOAD_SIZE_MB: ${cfg.maxDownloadSizeMB}. Must be between 1 and 1000.`);
  }
  
  if (cfg.maxUploadSizeMB < 1 || cfg.maxUploadSizeMB > 1000) {
    errors.push(`Invalid MAX_UPLOAD_SIZE_MB: ${cfg.maxUploadSizeMB}. Must be between 1 and 1000.`);
  }
  
  if (cfg.rateLimit.windowMs < 1000) {
    errors.push(`Invalid RATE_LIMIT_WINDOW_MS: ${cfg.rateLimit.windowMs}. Must be at least 1000.`);
  }
  
  if (cfg.rateLimit.max < 1) {
    errors.push(`Invalid RATE_LIMIT_MAX: ${cfg.rateLimit.max}. Must be at least 1.`);
  }
  
  if (cfg.maxInflightRequests < 1) {
    errors.push(`Invalid MAX_INFLIGHT_REQUESTS: ${cfg.maxInflightRequests}. Must be at least 1.`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Validate on load
validateConfig(config);

module.exports = config;