const mongoose = require('mongoose');
const User = require('./models/User');
const WalletTx = require('./models/WalletTransaction');
const WithdrawalRequest = require('./models/WithdrawalRequest');
require('dotenv').config();

async function debug() {
  try {
    await mongoose.connect('mongodb+srv://tai123:tai123@cluster0.p78vi.mongodb.net/GarageBooking?retryWrites=true&w=majority');
    
    // 1. Tìm tài xế vừa được phát lương
    const user = await User.findOne({ hoTen: /Tài/i }); // Tìm tạm theo tên có chữ "Tài"
    if (!user) {
      console.log('Không tìm thấy người dùng phù hợp');
    } else {
      console.log('--- User Info ---');
      console.log('ID:', user._id);
      console.log('Name:', user.hoTen);
      console.log('Balance:', user.viSoDu, 'Type:', typeof user.viSoDu);
      
      // 2. Tìm các giao dịch của user này
      const txs = await WalletTx.find({ userId: user._id });
      console.log('--- Transactions ---');
      console.log('Count:', txs.length);
      console.log('Data:', txs);

      // 3. Tìm các yêu cầu rút tiền
      const withdrawals = await WithdrawalRequest.find({ userId: user._id });
      console.log('--- Withdrawals ---');
      console.log('Count:', withdrawals.length);
      console.log('Data:', withdrawals);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
debug();
