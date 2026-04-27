const mongoose = require('mongoose');
const User = require('./models/User');
const WalletTx = require('./models/WalletTransaction');
require('dotenv').config();

async function check() {
  try {
    await mongoose.connect('mongodb+srv://tai123:tai123@cluster0.p78vi.mongodb.net/GarageBooking?retryWrites=true&w=majority');
    console.log('Connected');

    const users = await User.find({ viSoDu: { $gt: 0 } });
    console.log('Users with balance:', users.map(u => ({ name: u.hoTen, balance: u.viSoDu, id: u._id })));

    const latestTxs = await WalletTx.find().sort({ createdAt: -1 }).limit(5);
    console.log('Latest transactions:', latestTxs);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
