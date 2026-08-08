// js/environments.js
export const ENV = {
    development: {
        apiUrl: 'http://localhost:8000',
        firebase: 'dev-firebase-config'
    },
    staging: {
        apiUrl: 'https://staging.domain.com',
        firebase: 'staging-firebase-config'
    },
    production: {
        apiUrl: 'https://domain.com',
        firebase: 'prod-firebase-config'
    }
};

export const currentEnv = ENV[process.env.NODE_ENV || 'development'];