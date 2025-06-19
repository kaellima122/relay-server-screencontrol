const net = require('net');

// O Render.com vai fornecer a porta certa através de uma variável de ambiente.
// Se estivermos a testar localmente, ele usará a porta 10000.
const PORT = process.env.PORT || 10000;

console.log("======================================");
console.log("  Servidor de Retransmissão (Relay) v1.0");
console.log("======================================");

// Este objeto vai guardar as conexões ativas
// Ex: { "id_do_telemovel": { mobile: socket, pc: socket } }
const streams = {};

const server = net.createServer(socket => {
    // Esta função é executada sempre que um novo cliente se conecta
    console.log(`[INFO] Nova conexão de: ${socket.remoteAddress}:${socket.remotePort}`);

    let deviceId = null;
    let clientType = 'desconhecido';

    // Ouve pela primeira mensagem (o "handshake") para identificar o cliente
    socket.once('data', (chunk) => {
        const handshake = chunk.toString().trim();
        console.log(`[HANDSHAKE] Recebido: "${handshake.substring(0, 50)}..."`);

        const registerMatch = handshake.match(/^REGISTER \/(\S+)/);
        const subscribeMatch = handshake.match(/^SUBSCRIBE \/(\S+)/);

        if (registerMatch) {
            // É o telemóvel a registar-se
            deviceId = registerMatch[1];
            clientType = 'telemovel';
            if (!streams[deviceId]) streams[deviceId] = {};
            streams[deviceId].mobile = socket;
            console.log(`[REGISTO] Telemóvel com ID '${deviceId}' conectado.`);

        } else if (subscribeMatch) {
            // É o PC a subscrever
            deviceId = subscribeMatch[1];
            clientType = 'pc';
            if (!streams[deviceId]) streams[deviceId] = {};
            streams[deviceId].pc = socket;
            console.log(`[SUBSCRIÇÃO] PC subscrito ao ID '${deviceId}'.`);
        
        } else {
            console.log(`[AVISO] Handshake inválido. A fechar conexão.`);
            socket.end();
            return;
        }

        // Depois do handshake, qualquer dado recebido será retransmitido
        socket.on('data', (data) => {
            // Se a mensagem vem do telemóvel e o PC correspondente está conectado...
            if (clientType === 'telemovel' && streams[deviceId] && streams[deviceId].pc) {
                // ...reencaminha os dados para o PC.
                streams[deviceId].pc.write(data);
            }
        });
    });

    // Quando uma conexão é fechada
    socket.on('close', () => {
        console.log(`[FECHO] Conexão com ${clientType} (${deviceId || '?'}) fechada.`);
        if (deviceId && streams[deviceId]) {
            if (clientType === 'telemovel') streams[deviceId].mobile = null;
            else if (clientType === 'pc') streams[deviceId].pc = null;
        }
    });

    // Em caso de erro
    socket.on('error', (err) => {
        console.error(`[ERRO] Erro na conexão de ${clientType} (${deviceId || '?'}) : ${err.message}`);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[OK] Servidor de Relay a ouvir na porta ${PORT}`);
});