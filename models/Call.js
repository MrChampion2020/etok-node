const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  callerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  calleeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  callType: String, // audio or video
  callStatus: String,
  callDuration: Number,
  startTime: Date,
  endTime: Date,
});

module.exports = mongoose.model('Call', callSchema);