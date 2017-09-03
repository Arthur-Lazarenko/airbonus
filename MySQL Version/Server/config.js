/*-------------- ПАРАМЕТРЫ ------------------*/
var config = {

    // параметры MySQL
    mysql: {
        
        host: 'db.akite.org',
        port: '3306',
        user: 'pilot',
        password: 'Antratsit2017',
        database: 'pilot'
        
    },
    
    // параметры сервера
    server: {
        
        port: '8181',
        
        options: {
            
            // мс
            pingTimeout: 300000,
            // мс
            pingInterval: 300000
            
        }
        
    },

    /* ПАРАМЕТРЫ ЛОГГИРОВАНИЯ
    Уровень логирования (TRACE | DEBUG | INFO | WARN | ERROR | FATAL)
    FATAL   - ошибки приводящие к невозможности работы приложения
    ERROR   - ошибки, но приложение может продолжать работу
    WARN    - предупреждения о возможных проблемах и ошибках
    INFO    - информация о нормальном ходе выполненияи программы, которую нужно знать пользователю
    DEBUG   - информация о нормальном ходе выполненияи программы, предназначенная для разработчиков
    TRACE   - несущественная информация для глубокой отладки
    */
    
    // параметры логирования
    log: {
        
        level: 'TRACE',
        file: './logs/ws/log.txt',
        file_size: 1000000,
        file_backup: 20
        
    },
    
    // параметры директорий доступных извне
    dir: {
        
        files_directory: './files'
        
    },

    // параметры вычисления данных
    calculate: {
        
        // определение максимальной глубины рекурсии (максимальная комбинация карт)
        recursion_depth: 3,
        
        // количество вариантов для отдачи
        max_variants: 3
        
    }

};

/*-------------- ЭКСПОРТ ------------------*/
/*globals module*/
module.exports = config;
