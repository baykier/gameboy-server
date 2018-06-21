$(function () {

  var socket = io();
  //获取二维码
  $.get('http://127.0.0.1:3000/qrcode',{id:1},function(res){
      $('#image1').append('<image src="'+ res.url+'">')
      socket.emit('game start',res.room);//发送room
  })
// 接受按键
socket.on('play',function(data){
  
})
 //模拟器
  var screen = $("<canvas width='256' height='240'>");
  var context = screen[0].getContext('2d');
  var imageData = context.getImageData(0, 0, 256, 240);
  $("#emulator").append(screen);
  
  var nes = null;
  this.player = 0;
  var frame = 0;
  
  function clearScreen() {
    context.fillStyle = "black";
    context.fillRect(0, 0, 256, 240);
    for (var i = 3; i < imageData.data.length-3; i += 4) {
      imageData.data[i] = 0xFF;
    }
  }
  newGame();
  function createNes() {
    frame = 0;
    nes = new JSNES({});
    nes.ui.writeFrame = function (buffer, prevBuffer) {
      var data = imageData.data;
      var pixel, i, j;
      for (i=0; i<256*240; i++) {
          pixel = buffer[i];
          if (pixel != prevBuffer[i]) {
              j = i*4;
              data[j] = pixel & 0xFF;
              data[j+1] = (pixel >> 8) & 0xFF;
              data[j+2] = (pixel >> 16) & 0xFF;
              prevBuffer[i] = pixel;
          }
      }
      frame += 1;
      context.putImageData(imageData, 0, 0);
      // send at 30 fps
      if (frame === 2) {
        sendScreen();
        frame = 0;
      }
    };
  }
  
  function loadGames() {
    $.getJSON('/gamelist', function(data){
      var html = '';
      var len = data.games.length;
      for (var i = 0; i< len; i++) {
        html += '<option value="' + data.games[i] + '">' + data.games[i].replace(".nes","") + '</option>';
      }
      $('#current-game').append(html);
    });
  }
  
  function loadROM(url) {
    $.ajax({
      url: escape(url),
      xhr: function() {
        var xhr = $.ajaxSettings.xhr();
        xhr.overrideMimeType('text/plain; charset=x-user-defined');
        return xhr;
      },
      complete: function(xhr, status) {
        nes.loadRom(xhr.responseText);
        nes.start();
      }
    });
  }
  
  function triggerKey(type, keyCode) {
    var e = jQuery.Event(type);
    e.which = keyCode;
    e.keyCode = keyCode;
    $(document).trigger(e);
  }
  
  function sendKey(type, keyCode) {
    socket.send(type + " " + keyCode);
  }
  
  function sendScreen(buffer) {
    var image = screen[0].toDataURL();
    socket.send("data " + image);
  }
  
  function drawData(data) {
    var img = new Image();
    img.src = data;
    context.drawImage(img, 0, 0);
  }
  
  function startPlaying(data) {
    window.player = parseInt(data, 10);
    
    if (window.player == 1) {
      newGame();
      $("#games-list").show();
      $("#message").text("You are Player 1");
    }
    if (window.player == 2) {
      $("#games-list").hide();
      $("#message").text("You are Player 2");
    }
  }
  
  function newGame() {
    clearScreen();
    createNes();
    loadROM('/roms/SuperMario3.nes');
  }
  window.newGame = newGame;
  
  function stopPlaying() {
    if (nes !== null) {
      nes.stop();
      nes = null;
    }
    clearScreen();
    window.player = 0;
    $("#message").text("Waiting for Player 2");
  }
  
  socket.on('message',function (msg) {
    var parts = msg.data.split(" ");
    var cmd = parts[0];
    var data = parts[1];
  
    if (cmd === "join") {
      startPlaying(data);
    }
  
    if (cmd === "part") {
      stopPlaying();
    }
  
    if (cmd === "keyup" || cmd === "keydown") {
      triggerKey(cmd, parseInt(data, 10));
    }
  
    if (cmd === "data") {
      drawData(data);
    }
  });
  
  var keyMap = {
    88: 103,
    90: 105,
    17: 99,
    13: 97,
    38: 104,
    40: 98,
    37: 100,
    39: 102
  };
  
  $(document).bind("keydown", function(evt) {
    var code = evt.keyCode;
    if (window.player == 1) { nes.keyboard.keyDown(evt); }
    if (window.player == 2 && keyMap[code]) { evt.preventDefault(); sendKey("keydown", keyMap[code]); }
  });
  
  $(document).bind("keyup", function(evt) {
    var code = evt.keyCode;
    if (window.player == 1) { nes.keyboard.keyUp(evt); }
    if (window.player == 2 && keyMap[code]) { evt.preventDefault(); sendKey("keyup", keyMap[code]); }
  });
  
  clearScreen();
  loadGames();
  
  });