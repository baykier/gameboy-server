$(function () {

  var socket = io({
    autoConnect: false
  });
  var gameStart = false;
  //获取二维码  
  function getCode() {
    socket.open();
    $('.image').each(function (e) {
      var id = $(this).attr('data-id');     
      $.get('/qrcode',{id:id},function(res){
        $('.image.player' + id).html('<image src="'+ res.url+'">')
        socket.emit('game init', { room: res.room, id: id });//发送room和玩家号
      })
    })
  }
  getCode();
  //扫描二维码
  socket.on('scan', (data) => {
    var id = data.id;    
    $('.image.player' + id).html('<span>玩家已连接</span>');  
    //游戏已经开始不再重新开始游戏
    socket.emit('player join',data)
    if (gameStart)
    {
      return;
    }
    gameStart = true;
    newGame();
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
        frame = 0;
      }
    };
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
  }
  //游戏
  socket.on('play',function (data) {
    console.log(data);
    var cmd = data.type;
    var code = data.keyCode;  
    triggerKey(cmd, parseInt(code, 10));
  });
  //断开连接
  socket.on('disconnect', () => {
    $('.fresh').show();
    $('.fresh').bind('click', function () {
      getCode();
      $(this).hide();
    })
    console.log('点击刷新');
  });
  //按键操作
  $(document).bind("keydown", function (evt) { 
    try {
      nes.keyboard.keyDown(evt);
    } catch (e)
    {
      console.log(e);
    }
    
  });
  $(document).bind("keyup", function (evt) {
    try {
      nes.keyboard.keyUp(evt);  
    } catch (e)
    {
      console.log(e);
    }
   
  });  
  clearScreen();
});