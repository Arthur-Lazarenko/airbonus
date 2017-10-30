/************************ ПРЕДЗАГРУЗЧИК ************************/
/*globals $, document, window, showPagePreloader, showPageError, setTimeout*/

function showPageComputation() {

    'use strict';
    
    $(document).ready(function () {

        // показ прелоадера
        showPagePreloader();

        // установка задержки прелоадера
        setTimeout(function () {

            // отправка запроса на получение содержимого страницы
            $.ajax({

                url: "/core/include/php/pages/computation.php",

                dataType: "html",

                async: true,

                success: function (html) {

                    // идентификация страницы
                    window.identifierPrevious = window.identifier;
                    window.identifier = "computation";

                    // скрытие страницы
                    $("#loaded").hide();

                    // загрузка HTML-содержимого страницы
                    $("#loaded").html(html);
                    
                    // загрузка JS-содержимого страницы
                    $.getScript("/core/include/js/handlers/pages/computation/network.js");
                    $.getScript("/core/include/js/handlers/pages/computation/interface.js");
                    $.getScript("/core/include/js/handlers/pages/computation/launching.js");
                    
                    // показ страницы
                    $("#loaded").show();
                },

                error: function () {

                    // показ страницы с ошибкой
                    showPageError("page_exist");

                }

            });

        }, 600);

    });

}