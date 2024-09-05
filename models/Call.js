const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  callerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  calleeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  callType: String,
  callStatus: String,
  callDuration: Number
});

module.exports = mongoose.model('Call', callSchema);