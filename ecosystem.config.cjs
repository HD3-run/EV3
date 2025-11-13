const path = require('path');

module.exports = {
	apps: [
		// Backend Process
		{
			name: 'ecommittra-backend',
			interpreter: 'node',
			script: './node_modules/.bin/tsx', // Run TS directly
			args: 'backend/index.ts',
			cwd: path.resolve(__dirname),
			watch: false,
			env: {
				NODE_ENV: 'development',
				PORT: 5000
			},
			env_production: {
				NODE_ENV: 'production',
				PORT: 5000
			},
			autorestart: true,
			max_memory_restart: '1G',
			merge_logs: true,
			log_file: path.resolve(__dirname, 'logs/backend-combined.log'),
			out_file: path.resolve(__dirname, 'logs/backend-out.log'),
			error_file: path.resolve(__dirname, 'logs/backend-error.log')
		},
		// Frontend Process
		{
			name: 'ecommittra-frontend',
			interpreter: 'node',
			script: './node_modules/.bin/vite', // Vite preview for built frontend
			args: 'preview --port 5173 --host',
			cwd: path.resolve(__dirname),
			watch: false,
			env: {
				NODE_ENV: 'development',
				PORT: 5173
			},
			env_production: {
				NODE_ENV: 'production',
				PORT: 5173
			},
			autorestart: true,
			max_memory_restart: '1G',
			merge_logs: true,
			log_file: path.resolve(__dirname, 'logs/frontend-combined.log'),
			out_file: path.resolve(__dirname, 'logs/frontend-out.log'),
			error_file: path.resolve(__dirname, 'logs/frontend-error.log')
		}
	]
};