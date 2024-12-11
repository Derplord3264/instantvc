// Generate random room name if needed
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// TODO: Replace with your own channel ID
const drone = new ScaleDrone('yiS12Ts5RdNhebyM');
// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + roomHash;
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;
let remoteUserJoined = false; // Track if the remote user has joined

function onSuccess() {};
function onError(error) {
  console.error(error);
};

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });

  room.on('members', members => {
    console.log('MEMBERS', members);
    const isOfferer = members.length === 2;

    // Notify both users that they have joined
    if (isOfferer) {
      sendMessage({ type: 'userJoined' }); // Notify others that a user has joined
    }

    startWebRTC(isOfferer);
  });
});

// Send signaling data via Scaledrone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };

  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    }
  }

  navigator.mediaDevices.getUserMedia({
    audio: true,
  }).then(stream => {
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, onError);

  room.on('data', (message, client) => {
    // Message was sent by us
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    } else if (message.type === 'userJoined') {
      // When receiving the message that another user has joined
      remoteUserJoined = true; // Set the flag to true
      updateRemoteUserIcon(); // Update the icon for both users
    }
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({'sdp': pc.localDescription}),
    onError
  );
}

// Function to update the remote user's icon
function updateRemoteUserIcon() {
  const remoteImage = document.getElementById('remoteImage');
  if (remoteUserJoined) {
    remoteImage.classList.remove('grayscale'); // Remove grayscale class
  } else {
    remoteImage.classList.add('grayscale'); // Add grayscale class
  }
}

// Hide the loading overlay once the page has fully loaded
window.addEventListener('load', function() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  loadingOverlay.style.opacity = '0'; // Start fading out
  setTimeout(() => {
    loadingOverlay.style.display = 'none'; // Remove from view after fading out
  }, 500); // Match the timeout with the CSS transition duration
});
