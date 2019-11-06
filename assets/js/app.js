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

function render(peerConnections) {
    let container = document.getElementById("remoteVideoContainer")
    for ([memberId, pc] in Object.entries(peerConnections)) {
        let videoEl = document.createElement("video", {id: memberId})
        videoEl.srcObject = null
        container.append(videoEl)
    }
}

navigator.mediaDevices.getUserMedia({audio: false, video: true})
    .then(gotStream)
    .then(joinChannel)
    .then(setUpNewMembers)
    .catch(error => {
        console.log("getUserMedia error: ", error);
    });

let channel = socket.channel("call", {})

window.localStream = null
window.peerConnections = {}
window.localVideo = document.getElementById("localVideo");
window.remoteVideo = document.getElementById("remoteVideo1");
let callButton = document.getElementById("call");
let hangupButton = document.getElementById("hangup");

hangupButton.disabled = false;
callButton.disabled = false;
callButton.onclick = call;
hangupButton.onclick = hangup;

function joinChannel() {
    channel.join()
        .receive("ok", resp => {
            console.log("Joined successfully", resp)
        })
        .receive("error", resp => {
            console.log("Unable to join", resp)
        })
    channel.push("here")
}

function setUpNewMembers() {
    channel.on("new_member", ({member_id}) => {
        console.log("NEW MEMBER");
        peerConnections[member_id] = setupPeerConnection(member_id)
    })

    channel.on("member_left", ({member_id}) => {
        delete peerConnections[member_id]
    })
}

function gotStream(stream) {
    console.log("Received local stream");
    localVideo.srcObject = stream
    localStream = stream;
}

function setupPeerConnection(memberId) {
    callButton.disabled = false;
    hangupButton.disabled = false;
    console.log("Waiting for call");

    const servers = {iceServers: [{urls: "stun:stun.l.google.com:19302"}]};

    // Will will need multiple peer connections
    const peerConnection = new RTCPeerConnection(servers);
    console.log("Created local peer connection");
    peerConnection.onicecandidate = gotLocalIceCandidate;
    peerConnection.onaddstream = (event) => {
        gotRemoteStream(memberId, event);
    }
    peerConnection.addStream(localStream);
    console.log(peerConnection)
    console.log("Added localStream to localPeerConnection");

    return peerConnection
}

function call() {
    callButton.disabled = true;
    console.log("Starting call");
    for (let [memberId, peerConnection] of Object.entries(peerConnections)) {
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
    console.log("Answer from remotePeerConnection: \n");
    console.table(description.sdp);
    if (!peerConnections[description.sender_member_id]) {
        peerConnections[description.sender_member_id] = setupPeerConnection(description.sender_member_id)
    }
    let peerConnection = peerConnections[description.sender_member_id];
    peerConnection.setRemoteDescription(new RTCSessionDescription(description.sdp));
    peerConnection.createAnswer((answer) => {
        gotLocalDescription(peerConnection, answer, description.sender_member_id)
    }, handleError);
}

function gotRemoteStream(memberId, event) {
    let videoEl = document.getElementById(memberId)
    if (!videoEl) {
        let container = document.getElementById("remoteVideoContainer")
        videoEl = document.createElement("video", {id: memberId})
        videoEl.setAttribute("id", memberId)
        videoEl.setAttribute("autoplay", "true")
        container.append(videoEl)
    }
    videoEl.srcObject = event.stream
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
    if (peerConnections[event.member_id]) {
        callButton.disabled = true;
        if (event.candidate && event.member_id) {
            // Messages do not have member_id on them.
            if (!peerConnections[event.member_id]) {
                peerConnections[event.member_id] = setupPeerConnection(event.member_id)
            }
            peerConnections[event.member_id].addIceCandidate(new RTCIceCandidate(event.candidate))
                .then(() => console.log("ADDED THE ICE CANDIDATE!"))
                .catch(console.log);
            console.log("Remote ICE candidate: \n " + event.candidate.candidate);
        }
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
    callButton.disabled = true;
}

function handleError(error) {
    console.log(error.name + ": " + error.message);
}
