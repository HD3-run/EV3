const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://13.201.116.161:5173/", "http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "http://localhost:5000", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:5173", "http://127.0.0.1:5000",],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Serve the orders page
app.get('/orders', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'orders.html'));
});

// Handle root URL
app.get('/', (req, res) => {
    res.redirect('/orders');
});

// Initialize the WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth',
        clientId: 'whatsapp-bot'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-features=HttpsFirstBalancedModeAutoEnable'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('New client connected');

    // Handle QR code generation
    const handleQR = (qr) => {
        console.log('Generating QR code...');
        qrcode.toDataURL(qr, (err, url) => {
            if (err) {
                console.error('Error generating QR code:', err);
                socket.emit('error', 'Failed to generate QR code');
                return;
            }
            console.log('QR code generated, sending to client');
            socket.emit('qr', url);
            socket.emit('message', 'QR Code generated. Scan it with your phone.');
        });
    };

    // Set up event listeners for the WhatsApp client
    client.on('qr', handleQR);

    client.on('authenticated', () => {
        console.log('Client authenticated');
        socket.emit('authenticated', 'WhatsApp is authenticated!');
        socket.emit('message', 'WhatsApp is authenticated!');
    });

    client.on('ready', () => {
        console.log('Client is ready');
        socket.emit('ready', 'WhatsApp is ready!');
        socket.emit('message', 'WhatsApp is ready!');
    });

    client.on('message_create', async (message) => {
        try {
            console.log('Received message:', message.body);
            
            // Basic response to any message
            if (message.body.toLowerCase() === 'hello' || message.body.toLowerCase() === 'hi') {
                await message.reply('👋 Hello! I am your WhatsApp bot. How can I help you today?');
            } else if (message.body.toLowerCase() === 'help') {
                const helpText = `*Available commands:*
\n` +
                    `• *hello* or *hi* - Greet the bot\n` +
                    `• *help* - Show this help message\n` +
                    `• *order status* - Check your order status\n` +
                    `• *contact* - Get contact information`;
                await message.reply(helpText);
            } else if (message.body.toLowerCase().includes('order')) {
                await message.reply('To check your order status, please provide your order number.');
            } else {
                await message.reply('I\'m not sure how to respond to that. Type *help* to see available commands.');
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
        // Clean up the QR handler to prevent memory leaks
        client.removeListener('qr', handleQR);
    });

    // Handle generate QR code request
    socket.on('generateQR', () => {
        console.log('Received generateQR request');
        client.initialize().catch(err => {
            console.error('Failed to initialize WhatsApp client:', err);
            socket.emit('error', 'Failed to initialize WhatsApp client: ' + (err.message || 'Unknown error'));
        });
    });

    // If client is already authenticated, send ready status
    if (client.info) {
        console.log('Client already authenticated, sending ready status');
        socket.emit('ready', 'WhatsApp is ready!');
    }
});

// Start the server
const PORT = process.env.WHATSAPP_BOT_PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Visit http://localhost:${PORT}/orders to access the orders page`);
    
    // Don't auto-initialize on server start, wait for client request
    console.log('Waiting for client to request QR code...');
});

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    try {
        if (client.pupPage) {
            await client.destroy();
        }
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});