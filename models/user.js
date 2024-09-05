const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const userSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  gender: { type: String, required: true },
  dateOfBirth: { type: String, required: true },
  type: { type: String, required: true },
  country: { type: String, required: true },
  city: { type: String, required: true },
  homeTown: { type: String, required: true },
  datingPreferences: [{ type: String }],
  Coin: {type: Number, default: 0},
  Diamond: {type: Number, default: 0},
  Kiss: {type: Number, default: 0},
  Heart: {type: Number, default: 0},
  audioCallValue: Number,
  videoCallValue: Number,
  receiveAudioCalls: Boolean,
  receiveVideoCalls: Boolean,
  lookingFor: { type: String, required: true },
  imageUrls: [{ type: String }],
  prompts: [
    {
      question: { type: String, required: true },
      answer: { type: String, required: true },
    },
  ],
  likedProfiles: [{ type: Schema.Types.ObjectId, ref: "User" }],
  recievedLikes: [
    {
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      image: { type: String, required: true },
      comment: { type: String },
    },
  ],
  matches: [{ type: Schema.Types.ObjectId, ref: "User" }],
  blockedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

userSchema.pre('save', function(next) {
  if (!this.referralLink) {
    this.referralLink = `https://etok.us/register?ref=${this.lastName}`;
  }
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
