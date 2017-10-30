/************************ ОБРАБОТЧИКИ ЗАПУСКА ************************/
/*globals $, document*/

$(document).ready(function () {

    'use strict';
    
    // скрываем по умолчанию уведомления
    $("#computation-info_warning_block, #computation-info_warning, #computation-info_danger_block, #computation-info_danger").hide();
    
    // скрываем заголовок о отсутствии вариантов
    $("#computation-header_empty").hide();
    
    // запрос от сервера списка всех карт
    window.socket.emit("computation_get");
    
});