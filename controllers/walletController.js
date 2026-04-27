const WalletTx = require('../models/WalletTransaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');

// @desc    Get my wallet balance and transactions
// @route   GET /api/wallet/me
// @access  Private
exports.getMyWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('viSoDu');
    const txs = await WalletTx.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    const withdrawals = await WithdrawalRequest.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ 
      success: true, 
      data: { 
        balance: user?.viSoDu || 0, 
        transactions: txs,
        withdrawals
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Admin pay salary/commission to driver
// @route   POST /api/wallet/pay-salary
// @access  Private/Admin
exports.paySalary = async (req, res) => {
  try {
    const { driverId, note } = req.body;
    let { amount } = req.body;

    // Filter non-numeric characters (except for the first dot if any)
    if (typeof amount === 'string') {
      amount = amount.replace(/[^\d]/g, '');
    }
    const numAmount = Number(amount);

    if (!driverId || !numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });
    }

    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế' });
    }

    // Ensure viSoDu is a valid number before calculation
    const currentBalance = isNaN(driver.viSoDu) || driver.viSoDu === null ? 0 : driver.viSoDu;

    // Update balance
    driver.viSoDu = currentBalance + numAmount;
    await driver.save();

    // Create transaction record
    await WalletTx.create({
      userId: driverId,
      type: 'salary',
      amount: numAmount,
      ref: note || 'Phát lương/hoa hồng'
    });

    res.json({ 
      success: true, 
      message: `Đã phát ${numAmount.toLocaleString()}đ cho ${driver.hoTen}`,
      newBalance: driver.viSoDu
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Request withdrawal
// @route   POST /api/wallet/withdraw
// @access  Private
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, bankName, accountNumber, accountName } = req.body;
    const userId = req.user._id;

    if (!amount || amount < 50000) {
      return res.status(400).json({ success: false, message: 'Số tiền rút tối thiểu là 50,000đ' });
    }

    const user = await User.findById(userId);
    if (user.viSoDu < amount) {
      return res.status(400).json({ success: false, message: 'Số dư không đủ' });
    }

    const request = await WithdrawalRequest.create({
      userId,
      amount,
      bankName,
      accountNumber,
      accountName,
      status: 'pending'
    });

    res.json({ success: true, message: 'Yêu cầu rút tiền đã được gửi, vui lòng chờ Admin duyệt', data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Admin get all withdrawal requests
// @route   GET /api/wallet/admin/withdrawals
// @access  Private/Admin
exports.getWithdrawalRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    
    const requests = await WithdrawalRequest.find(filter)
      .populate('userId', 'hoTen soDienThoai viSoDu')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Admin process/approve withdrawal
// @route   PUT /api/wallet/admin/withdrawals/:id
// @access  Private/Admin
exports.processWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body; // status: 'approved', 'rejected', 'completed'

    const request = await WithdrawalRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu' });
    }

    if (request.status === 'completed' || request.status === 'rejected') {
      return res.status(400).json({ success: false, message: 'Yêu cầu này đã được xử lý xong' });
    }

    const user = await User.findById(request.userId);

    if (status === 'completed') {
      // Final deduction of balance
      const currentBalance = isNaN(user.viSoDu) || user.viSoDu === null ? 0 : user.viSoDu;
      
      if (currentBalance < request.amount) {
        return res.status(400).json({ success: false, message: 'Số dư người dùng hiện tại không đủ để thực hiện rút tiền' });
      }

      user.viSoDu = currentBalance - request.amount;
      await user.save();

      // Create transaction
      await WalletTx.create({
        userId: user._id,
        type: 'withdrawal',
        amount: -Number(request.amount),
        ref: `Rút tiền về ${request.bankName} - ${request.accountNumber}`
      });

      request.status = 'completed';
      request.processedAt = new Date();
    } else {
      request.status = status;
    }

    if (adminNote) request.adminNote = adminNote;
    await request.save();

    res.json({ success: true, message: 'Đã cập nhật trạng thái yêu cầu rút tiền', data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Admin fix corrupted balance (NaN/Null)
// @route   POST /api/wallet/admin/fix-balance/:id
// @access  Private/Admin
exports.fixBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

    if (isNaN(user.viSoDu) || user.viSoDu === null) {
      user.viSoDu = 0;
      await user.save();
      return res.json({ success: true, message: 'Đã khôi phục số dư về 0đ (do dữ liệu cũ bị hỏng)' });
    }

    res.json({ success: true, message: 'Số dư vẫn ổn định, không cần sửa' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Admin lấy toàn bộ lịch sử giao dịch hệ thống
// @route   GET /api/wallet/admin/transactions
// @access  Private/Admin
exports.getAllTransactions = async (req, res) => {
  try {
    const txs = await WalletTx.find({})
      .populate('userId', 'hoTen soDienThoai vaiTro')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, data: txs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};


