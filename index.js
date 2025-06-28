// File: index.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const authRoutes = require('./routes/authRoutes');
const tripRoutes = require('./routes/tripRoutes'); 
const bookingRoutes = require('./routes/bookingRoutes'); 


const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/', (req, res) => {
    res.send('API for Ha Phuong App is running...');
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, console.log(`Server đang chạy trên cổng ${PORT}`));