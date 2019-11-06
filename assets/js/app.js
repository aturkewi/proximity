// We need to import the CSS so that webpack will load it.
// The MiniCssExtractPlugin is used to separate it out into
// its own CSS file.
import css from "../css/app.css"

// webpack automatically bundles all modules in your
// entry points. Those entry points can be configured
// in "webpack.config.js".
//
// Import dependencies
//
import "phoenix_html"

import socket from "./socket"

let channel = socket.channel("call", {})
channel.join()
  .receive("ok", resp => {
    console.log("Joined successfully", resp)
  })
  .receive("error", resp => {
    console.log("Unable to join", resp)
  })

channel.push("here")

let localStream
let peerConnections = {}
let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo1");
let connectButton = document.getElementById("connect");
let callButton = document.getElementById("call");
let hangupButton = document.getElementById("hangup");

hangupButton.disabled = true;
callButton.disabled = true;
connectButton.onclick = connect;
callButton.onclick = call;
hangupButton.onclick = hangup;

function setupNewMemberHandler() {
  channel.on("new_member", ({member_id}) => {
    peerConnections[member_id] = setupPeerConnection()
  })
  channel.on("member_left", ({member_id}) => {
    delete peerConnections[member_id]
  })
}

function connect() {
  console.log("Requesting local stream");
  navigator.mediaDevices.getUserMedia({audio: false, video: true})
    .then(gotStream)
    .then(setupNewMemberHandler)
    .catch(error => {
      console.log("getUserMedia error: ", error);
    });
}

function gotStream(stream) {
  console.log("Received local stream");
  localVideo.srcObject = stream
  localStream = stream;
}

function setupPeerConnection() {
  connectButton.disabled = true;
  callButton.disabled = false;
  hangupButton.disabled = false;
  console.log("Waiting for call");

  let servers = {
    "iceServers": [{
      "url": "stun:stun.example.org"
    }]
  };

  // Will will need multiple peer connections
  const peerConnection = new RTCPeerConnection(servers);
  console.log("Created local peer connection");
  peerConnection.onicecandidate = gotLocalIceCandidate;
  peerConnection.onaddstream = gotRemoteStream;
  peerConnection.addStream(localStream);
  console.log(peerConnection)
  console.log("Added localStream to localPeerConnection");

  return peerConnection
}

function call() {
  callButton.disabled = true;
  console.log("Starting call");
  for(let [memberId, peerConnection] of Object.entries(peerConnections)) {
    peerConnection.createOffer((description) => {
      gotLocalDescription(peerConnection, description, memberId)
    }, handleError)
  }
}

function gotLocalDescription(peerConnection, description, memberId) {
  peerConnection.setLocalDescription(description, () => {
    channel.push("sdp_info", {
      body: JSON.stringify({
        "member_id": memberId,
        "sdp": peerConnection.localDescription
      })
    });
  }, handleError);
  console.log("Offer from localPeerConnection: \n" + description.sdp);
}

function gotRemoteDescription(description) {
  console.log("Answer from remotePeerConnection: \n" + description.sdp);
  if (!peerConnections[description.sender_member_id]) {
    peerConnections[description.sender_member_id] = setupPeerConnection()
  }
  let peerConnection = peerConnections[description.sender_member_id];
  peerConnection.setRemoteDescription(new RTCSessionDescription(description.sdp));
  peerConnection.createAnswer((answer) => {
      gotLocalDescription(peerConnection, answer, description.sender_member_id)
    }, handleError);
}

function gotRemoteStream(event) {
  remoteVideo.srcObject = event.stream
  console.log("Received remote stream");
}

function gotLocalIceCandidate(event) {
  if (event.candidate) {
    console.log("Local ICE candidate: \n" + event.candidate.candidate);
    channel.push("message", {
      body: JSON.stringify({
        "candidate": event.candidate
      })
    });
  }
}

function gotRemoteIceCandidate(event) {
  callButton.disabled = true;
  if (event.candidate && event.member_id) {
    if (!peerConnections[event.member_id]) {
      peerConnections[event.member_id] = setupPeerConnection()
    }
    peerConnections[event.member_id].addIceCandidate(new RTCIceCandidate(event.candidate));
    console.log("Remote ICE candidate: \n " + event.candidate.candidate);
  }
}

channel.on("message", payload => {
  let message = JSON.parse(payload.body);
  if (message.sdp) {
    gotRemoteDescription(message);
  } else {
    gotRemoteIceCandidate(message);
  }
})


function hangup() {
  console.log("Ending call");
  channel.push("close_connection")
  Object.values(peerConnections).forEach((pc) => pc.close());
  localVideo.src = null;
  peerConnections = {};
  hangupButton.disabled = true;
  connectButton.disabled = false;
  callButton.disabled = true;
}

function handleError(error) {
  console.log(error.name + ": " + error.message);
}
