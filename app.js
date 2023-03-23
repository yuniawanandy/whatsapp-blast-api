const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator')
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = process.env.PORT || 8000;
const open = require('open');
const chromePath = process.env.CHROME
require('events').EventEmitter.defaultMaxListeners = 30;

app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(fileUpload({
    debug: true
}));


app.get('/', (req, res) => {
    res.sendFile('index.html', {root: __dirname});
    //res.sendFile('favicon.ico', {root: __dirname});
    //res.sendFile('byf_logo.jpg', {root: __dirname});
});

const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
        executablePath: chromePath,
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            //'--single-process', // <- this one doesn't works in Windows
            '--disable-gpu'
          ],
        },
    authStrategy: new LocalAuth()
    });

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();

io.on('connection', function(socket){
    socket.on('init', () => {
        socket.emit('message', 'Connecting...')
    });

    client.on('qr', (qr) => {
        // Generate and scan this code with your phone
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit('qr', url);
            socket.emit('message', 'QR Code Received, Scan Please!');
        });
    });

    client.on('ready', () => {
        socket.emit('ready', 'Whatsapp is ready!');
        socket.emit('message', 'Whatsapp is ready!');
    });

    client.on('authenticated', (session) => {
        socket.emit('authenticated', 'Whatsapp is authenticated!');
        socket.emit('message', 'Whatsapp is authenticated!');
        console.log('Whatsapp is authenticated!');
    });

    client.on('disconnected', (reason) => {
        socket.emit('message', 'Whatsapp is disconnected!');
        client.destroy();
        client.initialize();
    });
});

const checkRegisteredNumber = async function(number){
    const isRegistered = await client.isRegisteredUser(number);
    return isRegistered;
}

app.post('/send-message', [
    body('number').notEmpty(),
    body('message').notEmpty(),
], async (req, res) =>{
    const error = validationResult(req).formatWith(({ msg }) => {
        return msg;
    });

    if ( !error.isEmpty()){
        return res.status(422).json({
            status: false,
            message: error.mapped()
        })
    }
    const number = phoneNumberFormatter(req.body.number);
    const message = req.body.message;

    const isRegistered = await checkRegisteredNumber(number);

    if(!isRegistered){
        return res.status(422).json({
            status: false,
            message: 'The number is not registered'
        });
    }

    client.sendMessage(number, message).then(response => {
        res.status(200).json({
            status: true,
            response: response
        });
    }).catch(err =>{
        res.status(500).json({
            status: false,
            response: err
        });
    });
});

var file;

app.post('/send-media', async (req, res) =>{
    const caption = req.body.caption;
    //const media = MessageMedia.fromFilePath('./tes.jpg');
    try{
        file = req.files.file;
    }
    catch (err){
        //console.log(err);
    }
    const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
    
    const numbers = req.body.number;
    let numbersArray = JSON.parse(numbers);
    let errorList = [];

    for(i=0; i<numbersArray.length; i++){
        let number = phoneNumberFormatter(numbersArray[i]);
        const isRegistered = await checkRegisteredNumber(number);

        if(!isRegistered){
            errorList.push('Failed! Number is not registered');
        }
        else{
            let status = await client.sendMessage(number, media, {caption: caption})
            .then(function() {
                return 'Success';
            })
            .catch(function() {
                return 'Failed';
            });

            errorList.push(status);
        }
    }

    let errorString = errorList.join(',');

    if(errorList.indexOf('Success') >= 0){
        res.status(200).json({
            status: true,
            response: errorString
        });
    }
    else{
        res.status(500).json({
            status: false,
            response: errorString
        });
    }
});


server.listen(port, function(){
    console.log('App running on *: ' + port);
    //open('http://localhost:8000');
});
