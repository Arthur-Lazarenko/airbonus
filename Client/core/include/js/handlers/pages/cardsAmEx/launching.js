/************************ ОБРАБОТЧИКИ ЗАПУСКА ************************/
/*globals $, document*/

$(document).ready(function () {

    'use strict';
    
    // запрос от сервера списка всех карты American Express
    window.socket.emit("cards_get_amEx");
    
});
