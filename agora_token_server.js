// Backend NodeJS tạo token động cho Agora, sẵn sàng deploy trên Render
const express = require('express');
const cors = require('cors');
const {RtcTokenBuilder, RtcRole} = require('agora-access-token');

const app = express();
app.use(cors());

const APP_ID = process.env.AGORA_APP_ID || "aec4d4a14d994fb1904ce07a17cd4c2c";
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || "3d183599eb3a42938b2395362dcd2f7b";

app.get('/rtcToken', (req, res) => {
  const channelName = req.query.channelName;
  if (!channelName) {
    return res.status(400).json({"error": "channelName is required"});
  }
  let uid = req.query.uid;
  if (!uid) {
    uid = 0;
  }
  const role = RtcRole.PUBLISHER;
  const expireTime = 3600;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;
  const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
  return res.json({"token": token});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Agora Token Server is running on port ${PORT}`);
});

// Hướng dẫn deploy trên Render:
// 1. Tạo repository trên GitHub chứa file này và package.json.
// 2. Trên Render, tạo dịch vụ Web Service, kết nối với repo vừa tạo.
// 3. Thêm biến môi trường AGORA_APP_ID và AGORA_APP_CERTIFICATE.
// 4. Render sẽ tự động chạy server, bạn dùng endpoint public của Render để lấy token trong Flutter.