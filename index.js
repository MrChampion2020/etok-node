const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const socketIo = require("socket.io");
const cors = require("cors");
const http = require("http");


const User = require("./models/user");
const Chat = require("./models/message");
const Call = require('./models/Call');

const app = express();
const port = 4000;


const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});



const jwt = require("jsonwebtoken");

app.use(
  cors({
    origin: "*", // Allow all origins
  })
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());

require("dotenv").config();
mongoose
  .connect(process.env.mongodb_connection, {})
  .then(() => {
    console.log("Connected to MongoDb");
  })
  .catch((error) => {
    console.log("Error connecting to MongoDb", error);
  });

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });



app.post("/register", async (req, res) => {
  try {
    const userData = req.body;

    const newUser = new User(userData);

    await newUser.save();

    // Generate JWT token
    const secretKey = crypto.randomBytes(32).toString("hex");
    const token = jwt.sign({ userId: newUser._id }, secretKey);

    res.status(200).json({ token });
  } catch (error) {
    console.error("Error registering user", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch user details
app.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(500).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching the user details" });
  }
});

// endpoint to login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email" });
    }

    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const secretKey = crypto.randomBytes(32).toString("hex");

    const token = jwt.sign({ userId: user._id }, secretKey);
    return res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: "Error logging in" });
  }
});

// matches

app.get("/matches", async (req, res) => {
  try {
    const { userId } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let filter = {};

    if (user.gender == "Men") {
      filter.gender = "Women";
    } else if (user.gender == "Women") {
      filter.gender = "Men";
    } else {
      console.log("Error somewhere in the code");
    }

    let query = {
      _id: { $ne: userId },
    };

    if (user.type) {
      filter.type = user.type;
    }

    const currentUser = await User.findById(userId)
      .populate("matches", "_id")
      .populate("likedProfiles", "_id"); // Corrected here

    const friendsIds = currentUser.matches.map((friend) => friend._id);

    const crushIds = currentUser.likedProfiles.map((crush) => crush._id);

    const matches = await User.find(filter)
      .where("_id")
      .nin([userId, ...friendsIds, ...crushIds]);

    return res.status(200).json({ matches });
  } catch (error) {
    console.error("Error fetching matches", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// end point for liking a profile
app.post("/like-profile", async (req, res) => {
  try {
    const { userId, likedUserId, image, comment } = req.body;

    // Update the liked user's receivedLikes array
    await User.findByIdAndUpdate(likedUserId, {
      $push: {
        recievedLikes: {
          userId: userId,
          image: image,
          comment: comment,
        },
      },
    });
    // Update the user's likedProfiles array
    await User.findByIdAndUpdate(userId, {
      $push: {
        likedProfiles: likedUserId,
      },
    });

    res.status(200).json({ message: "Profile liked successfully" });
  } catch (error) {
    console.error("Error liking profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/recieved-likes/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const likes = await User.findById(userId)
      .populate("recievedLikes.userId", "firstName imageUrls prompts")
      .select("recievedLikes");

    res.status(200).json({ recievedLikes: likes.recievedLikes });
  } catch (error) {
    console.error("Error fetching received likes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Endpoint to unlike a profile
app.post("/unlike-profile", async (req, res) => {
  try {
    const { userId, unlikedUserId } = req.body;

    // Update the unliked user's recievedLikes array
    await User.updateOne(
      { _id: userId },
      { $pull: { recievedLikes: { userId: unlikedUserId } } }
    );

    // Update the user's likedProfiles array
    await User.findByIdAndUpdate(userId, {
      $pull: {
        likedProfiles: unlikedUserId,
      },
    });

    res.status(200).json({ message: "Profile unliked successfully" });
  } catch (error) {
    console.error("Error unliking profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//endpoint to create a match betweeen two people
app.post("/create-match", async (req, res) => {
  try {
    const { currentUserId, selectedUserId } = req.body;
    //update the selected user's crushes array and the matches array
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { matches: currentUserId },
      $pull: { likedProfiles: currentUserId },
    });
    //update the current user's matches array recievedlikes array
    await User.findByIdAndUpdate(currentUserId, {
      $push: { matches: selectedUserId },
    });
    // Find the user document by ID and update the receivedLikes array
    const updatedUser = await User.findByIdAndUpdate(
      currentUserId,
      {
        $pull: { recievedLikes: { userId: selectedUserId } },
      },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    // If the user document was successfully updated
    res.status(200).json({ message: "ReceivedLikes updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error creating a match", error });
  }
});

// Endpoint to get all matches of a specific user
app.get("/get-matches/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user by ID and populate the matches field
    const user = await User.findById(userId).populate(
      "matches",
      "firstName imageUrls"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Extract matches from the user object
    const matches = user.matches;

    res.status(200).json({ matches });
  } catch (error) {
    console.error("Error getting matches:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

io.on("connection", (socket) => {
  console.log("a user is connected");

  socket.on("sendMessage", async (data) => {
    try {
      const { senderId, receiverId, message } = data;

      console.log("data", data);

      const newMessage = new Chat({ senderId, receiverId, message });
      await newMessage.save();

      //emit the message to the receiver
      io.to(receiverId).emit("receiveMessage", newMessage);
    } catch (error) {
      console.log("Error handling the messages", error);
    }
    socket.on("disconnet", () => {
      console.log("user disconnected");
    });
  });
});


app.get("/messages", async (req, res) => {
  try {
    const { senderId, receiverId } = req.query;

    console.log(senderId);
    console.log(receiverId);

    const messages = await Chat.find({
      $or: [
        { senderId: senderId, receiverId: receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    }).populate("senderId", "_id name");

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error in getting messages", error });
  }
});


const callController = {
  async makeCall(data) {
    try {
      const { callerId, calleeId, callType } = data;
      const call = new Call({ callerId, calleeId, callType });
      await call.save();
      io.to(calleeId).emit("incomingCall", call);
    } catch (error) {
      console.error("Error making call", error);
    }
  },

  async answerCall(data) {
    try {
      const { callId, answer } = data;
      const call = await Call.findById(callId);
      if (!call) return;
      call.answer = answer;
      await call.save();
      io.to(call.callerId).emit("callAnswered", call);
    } catch (error) {
      console.error("Error answering call", error);
    }
  },

  async endCall(data) {
    try {
      const { callId } = data;
      const call = await Call.findById(callId);
      if (!call) return;
      call.endTime = new Date();
      await call.save();
      io.to(call.callerId).emit("callEnded", call);
      io.to(call.calleeId).emit("callEnded", call);
    } catch (error) {
      console.error("Error ending call", error);
    }
  },
};


io.on("connection", (socket) => {
  console.log("a user is connected");

  socket.on("makeCall", (data) => {
    callController.makeCall(data);
  });

  io.on("answerCall", (data) => {
    callController.answerCall(data);
  });

  io.on("endCall", (data) => {
    callController.endCall(data);
  });
});



const peerConnections = {};

io.on("connection", (socket) => {
  console.log("a user is connected");

  socket.on("makeCall", (data) => {
    const { callerId, calleeId, callType } = data;
    const peerConnection = new RTCPeerConnection();
    peerConnections[callerId] = peerConnection;

    // Add audio and video streams to the peer connection
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then((stream) => {
        peerConnection.addStream(stream);
      })
      .catch((error) => {
        console.error("Error getting user media", error);
      });

    // Create an offer and set it as the local description
    peerConnection.createOffer()
      .then((offer) => {
        return peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        // Send the offer to the callee
        io.to(calleeId).emit("incomingCall", { offer, callerId, callType });
      })
      .catch((error) => {
        console.error("Error creating offer", error);
      });
  });

  io.on("answerCall", (data) => {
    const { callId, answer } = data;
    const peerConnection = peerConnections[callId];
    if (!peerConnection) return;

    // Set the remote description
    peerConnection.setRemoteDescription(answer)
      .then(() => {
        // Create an answer and set it as the local description
        peerConnection.createAnswer()
          .then((answer) => {
            return peerConnection.setLocalDescription(answer);
          })
          .then(() => {
            // Send the answer to the caller
            io.to(callId).emit("callAnswered", { answer });
          })
          .catch((error) => {
            console.error("Error creating answer", error);
          });
      })
      .catch((error) => {
        console.error("Error setting remote description", error);
      });
  });

  io.on("endCall", (data) => {
    const { callId } = data;
    const peerConnection = peerConnections[callId];
    if (!peerConnection) return;

    // Close the peer connection
    peerConnection.close();
    delete peerConnections[callId];
  });
});

// Check if a user is online
io.on("checkUserOnline", (receiverId, callback) => {
  // Check if the receiver is online by checking their socket connection
  const online = sockets[receiverId] !== undefined;
  callback(online);
});

// Deliver a missed call record
io.on("deliverMissedCall", (receiverId, senderId) => {
  // Deliver the missed call record to the receiver's ChatRoom
  // by emitting a "missedCall" event to the receiver's socket
  if (sockets[receiverId] !== undefined) {
    sockets[receiverId].emit("missedCall", senderId);
  } else {
    // If the receiver is offline, store the missed call record in the database
    axios.post(`${API_URL}/missedCalls`, {
      receiverId,
      senderId,
    });
  }
});

/*
// Set call values API
app.patch('/users/:id/audio-call-value', async (req, res) => {
  const user = await User.findById(req.params.id);
  user.audioCallValue = req.body.audioCallValue;
  await user.save();
  res.send(user);
});

app.patch('/users/:id/video-call-value', async (req, res) => {
  const user = await User.findById(req.params.id);
  user.videoCallValue = req.body.videoCallValue;
  await user.save();
  res.send(user);
});

// Calls API
app.post('/calls', async (req, res) => {
  const caller = await User.findById(req.body.callerId);
  const callee = await User.findById(req.body.calleeId);
  if (!caller || !callee) return res.status(404).send('User not found');
  if (caller.Coin < callee.audioCallValue && req.body.callType === 'audio') return res.status(402).send('Insufficient balance');
  if (caller.Coin < callee.videoCallValue && req.body.callType === 'video') return res.status(402).send('Insufficient balance');
  const call = new Call(req.body);
  await call.save();
  res.send(call);
});

app.post('/calls/:id/accept', async (req, res) => {
  const call = await Call.findById(req.params.id);
  call.callStatus = 'accepted';
  await call.save();
  const caller = await User.findById(call.callerId);
  const callee = await User.findById(call.calleeId);
  if (call.callType === 'audio') {
    callee.Coin += callee.audioCallValue;
    caller.Coin -= callee.audioCallValue;
  } else if (call.callType === 'video') {
    callee.Coin += callee.videoCallValue;
    caller.Coin -= callee.videoCallValue;
  }
  await callee.save();
  await caller.save();
  res.send(call);
});

app.post('/calls/:id/reject', async (req, res) => {
  const call = await Call.findById(req.params.id);
  call.callStatus = 'rejected';
  await call.save();
  res.send(call);
});

app.post('/calls/:id/end', async (req, res) => {
  const call = await Call.findById(req.params.id);
  call.callStatus = 'ended';
  await call.save();
  res.send(call);
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('makeCall', async (data) => {
    try {
      const caller = await User.findById(data.callerId);
      const callee = await User.findById(data.calleeId);
      if (!caller || !callee) return socket.emit('error', 'User not found');
      if (caller.Coin < callee.audioCallValue && data.callType === 'audio') return socket.emit('error', 'Insufficient balance');
      if (caller.Coin < callee.videoCallValue && data.callType === 'video') return socket.emit('error', 'Insufficient balance');
      const call = new Call(data);
      await call.save();
      socket.emit('callMade', call);
    } catch (error) {
      console.log('Error making call', error);
      socket.emit('error', 'Error making call');
    }
  });

  socket.on('acceptCall', async (data) => {
    try {
      const call = await Call.findById(data.callId);
      call.callStatus = 'accepted';
      await call.save();
      const caller = await User.findById(call.callerId);
      const callee = await User.findById(call.calleeId);
      if (call.callType === 'audio') {
        callee.Coin += callee.audioCallValue;
        caller.Coin -= callee.audioCallValue;
      } else if (call.callType === 'video') {
        callee.Coin += callee.videoCallValue;
        caller.Coin -= callee.videoCallValue;
      }
      await callee.save();
      await caller.save();
      socket.emit('callAccepted', call);
    } catch (error) {
      console.log('Error accepting call', error);
      socket.emit('error', 'Error accepting call');
    }
  });

  socket.on('rejectCall', async (data) => {
    try {
      const call = await Call.findById(data.callId);
      call.callStatus = 'rejected';
      await call.save();
      socket.emit('callRejected', call);
    } catch (error) {
      console.log('Error rejecting call', error);
      socket.emit('error', 'Error rejecting call');
    }
  });

  socket.on('endCall', async (data) => {
    try {
      const call = await Call.findById(data.callId);
      call.callStatus = 'ended';
      await call.save();
      socket.emit('callEnded', call);
    } catch (error) {
      console.log('Error ending call', error);
      socket.emit('error', 'Error ending call');
    }
  });
});

*/