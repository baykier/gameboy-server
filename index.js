// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var config = require('./config.js');
var port = process.env.PORT || 3000;
var request = require('request');
var qrcode = require('qrcode');
var session = require('express-session');
var cookie = require('cookie-parser');
var openid = [];

server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// 路由何session设置
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookie('gameboy'));
app.use(session({
  secret: 'gameboy',//与cookieParser中的一致
  resave: true,
  saveUninitialized:true,
  cookie:{
    path: '/', 
    httpOnly: true, 
    secure: false, 
    maxAge: null
  }
}));
 
//获取openid
app.get('/code', function (req, res) {
  //查询openid
  var code = req.param('code');
  console.log('微信小程序login' + code);
  request({
    url: 'https://api.weixin.qq.com/sns/jscode2session',
    qs: {
      appid: config.appId,
      secret: config.appSec,
      js_code: code,
      grant_type: 'authorization_code'
    }
  },function(err,resonse,body){
    var body = JSON.parse(body);    
    openid[body.openid] = body;
    res.send({ code: 0, msg: 'ok' ,'openid': body.openid});
  })
  console.log(openid);
});
//二维码 扫码后用sessionID代表进入哪个房间
app.get('/qrcode', function (req, res) {
  var room = req.sessionID;
  var id = req.param('id'); 
  console.log('获取' + room + '玩家' + id +'的二维码')
  qrcode.toDataURL(room + ' ' + id, function(err, url) {    
      res.send({'url':url,'room':room})
    }
  )    
})


// 游戏
var numUsers = 0;
var rooms = [];//房间数

io.on('connection', (socket) => {
  
  // 新用户扫码
  socket.on('user join', (data,fn) => {
    numUsers++;
    var msg = data.result.split(' ');
    var room = msg[0];
    var id = msg[1];
    //判断房间号是否有效
    if (typeof rooms[room] == 'undefined')
    {
      console.log('room[' + room + ']二维码已过期');
      fn('error');//错误
    } else {
      console.log('微信用户' + data.openid + '作为玩家' + id + '加入房间' + room)
      socket.openid = data.openid;
      socket.room = room;
      socket.join(room);
      socket.to(room).emit('scan', {
        room: room,
        openid: data.openid,
        id: id
      });
      fn('success');//成功
    }
  });
  //游戏初始化
  socket.on('game init',(data) => {
    console.log('显示游戏主页')
    console.log(data);
    rooms[data.room] = data.room;
    socket.room = data.room;
    socket.player1 = false;
    socket.player2 = false;
    socket.join(data)
    //5s后不连接自动断开
    // setTimeout(function () {
    //   if (!socket.player1) {
    //       console.log('超时未连接，自动关闭');
    //       delete rooms[data.room];
    //       socket.disconnect(true);
    //   }
    // },5000)
  });

  // 游戏按键
  socket.on('user control', (data) => {
    console.log('游戏按键')
    console.log(data)
    console.log(socket.room);
    socket.to(socket.room).emit('play',data);
  }); 
  // 断开链接
  socket.on('disconnect', () => {
      console.log(socket.room + 'left');
      socket.to(socket.room).emit('left','222' );
  });
});
