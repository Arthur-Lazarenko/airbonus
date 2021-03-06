﻿/* МЕТОД ДЛЯ ОБРАБОТЧИКОВ API */

let cards_module = require("./computation/cards");

/*---------------------------- МЕТОД ДЛЯ ОБРАБОТЧИКОВ API -------------------------------*/
module.exports.get = (config, params, database, log, async, callback) => {
    // данные для работы
    let data = {
            result: {
                //не отсортированый конечный результат
                unsorted: [],

                // отсортированый конечный результат
                sorted: [],

                // разделённые результаты
                separated: [],

                // количество перебраных вариантов при рассчёте
                treated_combinations: 0
            },

            routes: {
                // прямые рейсы
                direct: null,

                // обратные рейсы
                back: null
            },

            cards: {
                // имеющиеся карты
                available: [],

                // доступные карты
                free: [],

                // преобразованные карты
                conversion: []
            },

            // допустимые авиалинии к картам
            authorized_airlines: [],

            routes_cost: {
                available: {
                    // стоимости прямых рейсов имеющихся карт
                    direct: [],

                    // стоимости обратных рейсов имеющихся карт
                    back: []
                },

                free: {
                    // стоимости прямых рейсов свободных карт
                    direct: [],

                    // стоимости обратных рейсов свободных карт
                    back: []
                },

                conversion: {
                    // стоимости прямых рейсов рассчитаных бонусных карт
                    direct: [],

                    // стоимости прямых рейсов рассчитаных бонусных карт
                    back: []
                }
            }
        },
        // выбор прямых рейсов
        selectDirectRoutes = (conn, done) => {
            conn.query(
                "SELECT airlines.name, routes_per_region.airline_iata, routes_per_region.price_miles, regions.miles, routes_per_region.source, routes_per_region.destination FROM routes_per_region, airlines, regions WHERE airlines.iata = routes_per_region.airline_iata AND routes_per_region.source = ? AND routes_per_region.destination = ? AND regions.region = routes_per_region.region AND regions.airline_iata = routes_per_region.airline_iata ORDER BY routes_per_region.price_miles, regions.miles",
                [params.userAirportFrom, params.userAirportTo],
                (error, routes) => {
                    if (error) {
                        log.debug("Error MySQL connection: " + error);
                        done();
                    } else {
                        data.routes.direct = routes;
                        done();
                    }
                }
            );
        },
        // выбор обратных рейсов
        selectBackRoutes = (conn, done) => {
            conn.query(
                "SELECT airlines.name, routes_per_region.airline_iata, routes_per_region.price_miles, regions.miles, routes_per_region.source, routes_per_region.destination FROM routes_per_region, airlines, regions WHERE airlines.iata = routes_per_region.airline_iata AND routes_per_region.source = ? AND routes_per_region.destination = ? AND regions.region = routes_per_region.region AND regions.airline_iata = routes_per_region.airline_iata ORDER BY routes_per_region.price_miles, regions.miles",
                [params.userAirportFrom, params.userAirportTo],
                (error, routes) => {
                    if (error) {
                        log.debug("Error MySQL connection: " + error);
                        done();
                    } else {
                        data.routes.back = routes;
                        done();
                    }
                }
            );
        },
        // выбор имеющихся карт
        selectAvailableCards = (conn, done) => {
            // пользовательские карты
            let user_cards = [];

            async.series(
                [
                    // переписываем имеющиеся карты в массив
                    done => {
                        let i;
                        for (i = 0; i < params.allCards.length; i += 1) {
                            user_cards.push(params.allCards[i].card);

                            if (i === params.allCards.length - 1) {
                                done();
                            }
                        }

                        if (params.allCards.length === 0) {
                            done();
                        }
                    },

                    // выбираем имеющиеся карты
                    done => {
                        if (
                            user_cards.length &&
                            data.authorized_airlines.length
                        ) {
                            // делаем запрос на выбор всех карт, которые есть у пользователя
                            conn.query(
                                "SELECT cards.id, cards.name, cards.program_id, cards.bonus_cur, cards.amount, cards.fee1, cards.link, cards.image, cards.airline_iata, cards.id FROM cards WHERE cards.id IN (" +
                                    user_cards +
                                    ") AND cards.airline_iata IN (" +
                                    data.authorized_airlines +
                                    ") ORDER BY cards.amount",
                                (error, available_cards) => {
                                    if (error) {
                                        log.debug(
                                            "Error MySQL connection: " + error
                                        );
                                        done();
                                    } else {
                                        // счётчики
                                        let cards_db_count,
                                            card_mile,
                                            act_count;

                                        // обозначение карт как имеющиеся
                                        for (
                                            cards_db_count = 0;
                                            cards_db_count <
                                            available_cards.length;
                                            cards_db_count += 1
                                        ) {
                                            available_cards[
                                                cards_db_count
                                            ].have = true;
                                        }

                                        // перезапись карт для удобства рассчётов
                                        for (
                                            cards_db_count = 0;
                                            cards_db_count <
                                            available_cards.length;
                                            cards_db_count += 1
                                        ) {
                                            if (
                                                params.amExCards.indexOf(
                                                    Number(
                                                        available_cards[
                                                            cards_db_count
                                                        ].id
                                                    )
                                                ) === -1
                                            ) {
                                                data.cards.available.push({
                                                    // текущая карта
                                                    card:
                                                        available_cards[
                                                            cards_db_count
                                                        ],

                                                    // параметры
                                                    params: {
                                                        card_id: Number(
                                                            available_cards[
                                                                cards_db_count
                                                            ].id
                                                        ),
                                                        converted_from_card: Number(
                                                            available_cards[
                                                                cards_db_count
                                                            ].id
                                                        ),

                                                        amount: Number(
                                                            available_cards[
                                                                cards_db_count
                                                            ].amount
                                                        ),
                                                        fee1: Number(
                                                            available_cards[
                                                                cards_db_count
                                                            ].fee1
                                                        ),
                                                        bonus_cur: Number(
                                                            available_cards[
                                                                cards_db_count
                                                            ].bonus_cur
                                                        )
                                                    },

                                                    // преобразованные карты
                                                    converted_cards: []
                                                });
                                            }
                                        }

                                        // определение установленного пользователем значения бонусов для каждой из карт
                                        for (
                                            cards_db_count = 0;
                                            cards_db_count <
                                            data.cards.available.length;
                                            cards_db_count += 1
                                        ) {
                                            for (
                                                act_count = 0;
                                                act_count <
                                                params.allCards.length;
                                                act_count += 1
                                            ) {
                                                if (
                                                    Number(
                                                        data.cards.available[
                                                            cards_db_count
                                                        ].card.id
                                                    ) ===
                                                    Number(
                                                        params.allCards[
                                                            act_count
                                                        ].card
                                                    )
                                                ) {
                                                    data.cards.available[
                                                        cards_db_count
                                                    ].card.bonus_cur = data.cards.available[
                                                        cards_db_count
                                                    ].params.bonus_cur =
                                                        params.allCards[
                                                            act_count
                                                        ].bonus;
                                                }
                                            }

                                            if (
                                                cards_db_count ===
                                                data.cards.available.length - 1
                                            ) {
                                                done();
                                            }
                                        }

                                        if (data.cards.available.length === 0) {
                                            done();
                                        }
                                    }
                                }
                            );
                        } else {
                            done();
                        }
                    }
                ],
                () => {
                    done();
                }
            );
        },
        // расчёт стоимостей имеющихся карт
        calcCostAvailableCards = (conn, done) => {
            // счётчики
            let card_count, act_count, route_count, people_count;

            // поиск доступных карт, на которых есть достаточное количество бонусов
            for (
                card_count = 0;
                card_count < data.cards.available.length;
                card_count += 1
            ) {
                //--------------------- прямой маршрут ---------------------//

                // проверка бонусов на карте с требованием поездки
                for (
                    route_count = 0;
                    route_count < data.routes.direct.length;
                    route_count += 1
                ) {
                    // проверка достаточности оплаты от мин. (1) к макс. количеству людей
                    for (
                        people_count = 1;
                        people_count <= params.maxPeople + params.statusValue;
                        people_count += 1
                    ) {
                        // проверка на возможность покупки разного количества билетов за бонусы
                        if (
                            data.cards.available[card_count].params.bonus_cur >=
                                data.routes.direct[route_count].price_miles *
                                    people_count &&
                            data.cards.available[card_count].card
                                .airline_iata ===
                                data.routes.direct[route_count].airline_iata &&
                            data.cards.available[card_count].params.amount +
                                data.cards.available[card_count].params.fee1 <=
                                Number(
                                    params.spendNextMonth * 3 +
                                        (params.spendNextYear -
                                            params.spendNextMonth * 12) *
                                            0.5
                                )
                        ) {
                            // добавление записи
                            data.routes_cost.available.direct.push({
                                card: String(
                                    data.cards.available[card_count].card.name
                                ),

                                card_id: Number(
                                    data.cards.available[card_count].params
                                        .card_id
                                ),

                                airline: String(
                                    data.routes.direct[route_count].name
                                ),

                                from: String(
                                    data.routes.direct[route_count].source
                                ),

                                to: String(
                                    data.routes.direct[route_count].destination
                                ),

                                fee1: Number(
                                    data.cards.available[card_count].card.fee1
                                ),

                                amount: 0,

                                price_of_one_ticket: Number(
                                    data.routes.direct[route_count].price_miles
                                        ? Number(
                                              data.routes.direct[route_count]
                                                  .price_miles
                                          )
                                        : Number(
                                              data.routes.direct[route_count]
                                                  .miles
                                          )
                                ),

                                mile:
                                    Number(
                                        data.routes.direct[route_count]
                                            .price_miles
                                            ? Number(
                                                  data.routes.direct[
                                                      route_count
                                                  ].price_miles
                                              )
                                            : Number(
                                                  data.routes.direct[
                                                      route_count
                                                  ].miles
                                              )
                                    ) * people_count,

                                available_amount_of_bonuses: Number(
                                    data.cards.available[card_count].card
                                        .bonus_cur
                                ),

                                tickets_direct: Number(people_count),

                                tickets_back: 0,

                                link: String(
                                    data.cards.available[card_count].card.link
                                ),

                                image: String(
                                    data.cards.available[card_count].card.image
                                ),

                                have: Boolean(
                                    data.cards.available[card_count].card.have
                                ),

                                conversion: false,

                                direct: true,

                                params: data.cards.available[card_count].params,

                                converted_cards: []
                            });
                        }
                    }
                }

                //--------------------- обратный маршрут ---------------------//

                // проверка бонусов на карте с требованием поездки
                for (
                    route_count = 0;
                    route_count < data.routes.back.length;
                    route_count += 1
                ) {
                    // проверка достаточности оплаты от мин. (1) к макс. количеству людей
                    for (
                        people_count = 1;
                        people_count <= params.maxPeople + params.statusValue;
                        people_count += 1
                    ) {
                        // проверка на возможность покупки разного количества билетов за бонусы
                        if (
                            data.cards.available[card_count].params.bonus_cur >=
                                data.routes.back[route_count].price_miles *
                                    people_count &&
                            data.cards.available[card_count].card
                                .airline_iata ===
                                data.routes.back[route_count].airline_iata &&
                            data.cards.available[card_count].params.amount +
                                data.cards.available[card_count].params.fee1 <=
                                Number(
                                    params.spendNextMonth * 3 +
                                        (params.spendNextYear -
                                            params.spendNextMonth * 12) *
                                            0.5
                                )
                        ) {
                            // добавление записи
                            data.routes_cost.available.back.push({
                                card: String(
                                    data.cards.available[card_count].card.name
                                ),

                                card_id: Number(
                                    data.cards.available[card_count].params
                                        .card_id
                                ),

                                airline: String(
                                    data.routes.back[route_count].name
                                ),

                                from: String(
                                    data.routes.back[route_count].destination
                                ),

                                to: String(
                                    data.routes.back[route_count].source
                                ),

                                fee1: Number(
                                    data.cards.available[card_count].card.fee1
                                ),

                                amount: 0,

                                price_of_one_ticket: Number(
                                    data.routes.back[route_count].price_miles
                                        ? Number(
                                              data.routes.back[route_count]
                                                  .price_miles
                                          )
                                        : Number(
                                              data.routes.back[route_count]
                                                  .miles
                                          )
                                ),

                                mile:
                                    Number(
                                        data.routes.back[route_count]
                                            .price_miles
                                            ? Number(
                                                  data.routes.back[route_count]
                                                      .price_miles
                                              )
                                            : Number(
                                                  data.routes.back[route_count]
                                                      .miles
                                              )
                                    ) * people_count,

                                available_amount_of_bonuses: Number(
                                    data.cards.available[card_count].card
                                        .bonus_cur
                                ),

                                tickets_direct: 0,

                                tickets_back: Number(people_count),

                                link: String(
                                    data.cards.available[card_count].card.link
                                ),

                                image: String(
                                    data.cards.available[card_count].card.image
                                ),

                                have: Boolean(
                                    data.cards.available[card_count].card.have
                                ),

                                conversion: false,

                                direct: false,

                                params: data.cards.available[card_count].params,

                                converted_cards: []
                            });
                        }
                    }
                }

                if (card_count === data.cards.available.length - 1) {
                    done();
                }
            }

            if (data.cards.available.length === 0) {
                done();
            }
        },
        // выбор доступных карт
        selectFreeCards = (conn, done) => {
            // идентификаторы карт пользователя
            let user_cards = [];

            async.series(
                [
                    // переписываем имеющиеся карты в массив
                    done => {
                        let i;
                        for (i = 0; i < params.allCards.length; i += 1) {
                            user_cards.push(params.allCards[i].card);

                            if (i === params.allCards.length - 1) {
                                done();
                            }
                        }

                        if (params.allCards.length === 0) {
                            done();
                        }
                    },

                    // расчёт свободных карт
                    done => {
                        // делаем запрос на выбор всех карт, кроме тех, которые есть у пользователя
                        let query;
                        if (user_cards.length) {
                            if (data.authorized_airlines.length) {
                                query =
                                    "SELECT cards.id, cards.name, cards.program_id, cards.bonus_cur, cards.amount, cards.fee1, cards.link, cards.image, cards.airline_iata FROM cards WHERE cards.id NOT IN (" +
                                    user_cards +
                                    ") AND cards.airline_iata IN (" +
                                    data.authorized_airlines +
                                    ") ORDER BY cards.fee1";
                            } else {
                                done();
                                return;
                            }
                        } else {
                            if (data.authorized_airlines.length) {
                                query =
                                    "SELECT cards.id, cards.name, cards.program_id, cards.bonus_cur, cards.amount, cards.fee1, cards.link, cards.image, cards.airline_iata FROM cards WHERE cards.airline_iata IN (" +
                                    data.authorized_airlines +
                                    ") ORDER BY cards.fee1";
                            } else {
                                done();
                                return;
                            }
                        }

                        conn.query(query, (error, free_cards) => {
                            if (error) {
                                log.debug("Error MySQL connection: " + error);
                                done();
                            } else {
                                // обозначение карт как не имеющиеся
                                let cards_db_count;
                                for (
                                    cards_db_count = 0;
                                    cards_db_count < free_cards.length;
                                    cards_db_count += 1
                                ) {
                                    free_cards[cards_db_count].have = false;
                                }

                                // перезапись карт для удобства рассчётов
                                for (
                                    cards_db_count = 0;
                                    cards_db_count < free_cards.length;
                                    cards_db_count += 1
                                ) {
                                    if (
                                        params.amExCards.indexOf(
                                            Number(
                                                free_cards[cards_db_count].id
                                            )
                                        ) === -1
                                    ) {
                                        data.cards.free.push({
                                            // текущая карта
                                            card: free_cards[cards_db_count],

                                            // параметры
                                            params: {
                                                card_id: Number(
                                                    free_cards[cards_db_count]
                                                        .id
                                                ),
                                                converted_from_card: Number(
                                                    free_cards[cards_db_count]
                                                        .id
                                                ),

                                                amount: Number(
                                                    free_cards[cards_db_count]
                                                        .amount
                                                ),
                                                fee1: Number(
                                                    free_cards[cards_db_count]
                                                        .fee1
                                                ),
                                                bonus_cur: Number(
                                                    free_cards[cards_db_count]
                                                        .bonus_cur
                                                )
                                            },

                                            // преобразованные карты
                                            converted_cards: []
                                        });
                                    }
                                }

                                done();
                            }
                        });
                    }
                ],
                () => {
                    done();
                }
            );
        },
        // расчёт стоимостей свободных карт
        calcCostFreeCards = (conn, done) => {
            // счётчики
            let card_count, route_count, people_count;

            // поиск доступных карт, на которых есть достаточное количество бонусов
            for (
                card_count = 0;
                card_count < data.cards.free.length;
                card_count += 1
            ) {
                //--------------------- прямой маршрут ---------------------//

                // проверка бонусов на карте с требованием поездки
                for (
                    route_count = 0;
                    route_count < data.routes.direct.length;
                    route_count += 1
                ) {
                    // проверка достаточности оплаты от мин. (1) к макс. количеству людей
                    for (
                        people_count = 1;
                        people_count <= params.maxPeople + params.statusValue;
                        people_count += 1
                    ) {
                        // проверка на возможность покупки разного количества билетов за бонусы
                        if (
                            data.cards.free[card_count].params.bonus_cur >=
                                data.routes.direct[route_count].price_miles *
                                    people_count &&
                            data.cards.free[card_count].card.airline_iata ===
                                data.routes.direct[route_count].airline_iata &&
                            data.cards.free[card_count].params.amount +
                                data.cards.free[card_count].params.fee1 <=
                                Number(
                                    params.spendNextMonth * 3 +
                                        (params.spendNextYear -
                                            params.spendNextMonth * 12) *
                                            0.5
                                )
                        ) {
                            // добавление записи
                            data.routes_cost.free.direct.push({
                                card: String(
                                    data.cards.free[card_count].card.name
                                ),

                                card_id: Number(
                                    data.cards.free[card_count].params.card_id
                                ),

                                airline: String(
                                    data.routes.direct[route_count].name
                                ),

                                from: String(
                                    data.routes.direct[route_count].source
                                ),

                                to: String(
                                    data.routes.direct[route_count].destination
                                ),

                                fee1: Number(
                                    data.cards.free[card_count].card.fee1
                                ),

                                amount: Number(
                                    data.cards.free[card_count].card.amount
                                ),

                                price_of_one_ticket: Number(
                                    data.routes.direct[route_count].price_miles
                                        ? Number(
                                              data.routes.direct[route_count]
                                                  .price_miles
                                          )
                                        : Number(
                                              data.routes.direct[route_count]
                                                  .miles
                                          )
                                ),

                                mile:
                                    Number(
                                        data.routes.direct[route_count]
                                            .price_miles
                                            ? Number(
                                                  data.routes.direct[
                                                      route_count
                                                  ].price_miles
                                              )
                                            : Number(
                                                  data.routes.direct[
                                                      route_count
                                                  ].miles
                                              )
                                    ) * people_count,

                                available_amount_of_bonuses: Number(
                                    data.cards.free[card_count].card.bonus_cur
                                ),

                                tickets_direct: Number(people_count),

                                tickets_back: 0,

                                link: String(
                                    data.cards.free[card_count].card.link
                                ),

                                image: String(
                                    data.cards.free[card_count].card.image
                                ),

                                have: Boolean(
                                    data.cards.free[card_count].card.have
                                ),

                                conversion: false,

                                direct: true,

                                params: data.cards.free[card_count].params,

                                converted_cards: []
                            });
                        }
                    }
                }

                //--------------------- обратный маршрут ---------------------//

                // проверка бонусов на карте с требованием поездки
                for (
                    route_count = 0;
                    route_count < data.routes.back.length;
                    route_count += 1
                ) {
                    // проверка достаточности оплаты от мин. (1) к макс. количеству людей
                    for (
                        people_count = 1;
                        people_count <= params.maxPeople + params.statusValue;
                        people_count += 1
                    ) {
                        // проверка на возможность покупки разного количества билетов за бонусы
                        if (
                            data.cards.free[card_count].params.bonus_cur >=
                                data.routes.back[route_count].price_miles *
                                    people_count &&
                            data.cards.free[card_count].card.airline_iata ===
                                data.routes.back[route_count].airline_iata &&
                            data.cards.free[card_count].params.amount +
                                data.cards.free[card_count].params.fee1 <=
                                Number(
                                    params.spendNextMonth * 3 +
                                        (params.spendNextYear -
                                            params.spendNextMonth * 12) *
                                            0.5
                                )
                        ) {
                            // добавление записи
                            data.routes_cost.free.back.push({
                                card: String(
                                    data.cards.free[card_count].card.name
                                ),

                                card_id: Number(
                                    data.cards.free[card_count].params.card_id
                                ),

                                airline: String(
                                    data.routes.back[route_count].name
                                ),

                                from: String(
                                    data.routes.back[route_count].destination
                                ),

                                to: String(
                                    data.routes.back[route_count].source
                                ),

                                fee1: Number(
                                    data.cards.free[card_count].card.fee1
                                ),

                                price_of_one_ticket: Number(
                                    data.routes.back[route_count].price_miles
                                        ? Number(
                                              data.routes.back[route_count]
                                                  .price_miles
                                          )
                                        : Number(
                                              data.routes.back[route_count]
                                                  .miles
                                          )
                                ),

                                amount: Number(
                                    data.cards.free[card_count].card.amount
                                ),

                                mile:
                                    Number(
                                        data.routes.back[route_count]
                                            .price_miles
                                            ? Number(
                                                  data.routes.back[route_count]
                                                      .price_miles
                                              )
                                            : Number(
                                                  data.routes.back[route_count]
                                                      .miles
                                              )
                                    ) * people_count,

                                available_amount_of_bonuses: Number(
                                    data.cards.free[card_count].card.bonus_cur
                                ),

                                tickets_direct: 0,

                                tickets_back: Number(people_count),

                                link: String(
                                    data.cards.free[card_count].card.link
                                ),

                                image: String(
                                    data.cards.free[card_count].card.image
                                ),

                                have: Boolean(
                                    data.cards.free[card_count].card.have
                                ),

                                conversion: false,

                                direct: false,

                                params: data.cards.free[card_count].params,

                                converted_cards: []
                            });
                        }
                    }
                }

                if (card_count === data.cards.free.length - 1) {
                    done();
                }
            }

            if (data.cards.free.length === 0) {
                done();
            }
        },
        // определение разрешённых авиалиний карт для прямых рейсов
        identifyAirlinesForDirect = done => {
            let i;
            for (i = 0; i < data.routes.direct.length; i += 1) {
                if (
                    data.authorized_airlines.indexOf(
                        "'" + data.routes.direct[i].airline_iata + "'"
                    ) === -1
                ) {
                    data.authorized_airlines.push(
                        "'" + data.routes.direct[i].airline_iata + "'"
                    );
                }

                if (i === data.routes.direct.length - 1) {
                    done();
                }
            }

            if (data.routes.direct.length === 0) {
                done();
            }
        },
        // определение разрешённых авиалиний карт для обратных рейсов
        identifyAirlinesForBack = done => {
            let i;
            for (i = 0; i < data.routes.back.length; i += 1) {
                if (
                    data.authorized_airlines.indexOf(
                        "'" + data.routes.back[i].airline_iata + "'"
                    ) === -1
                ) {
                    data.authorized_airlines.push(
                        "'" + data.routes.back[i].airline_iata + "'"
                    );
                }

                if (i === data.routes.back.length - 1) {
                    done();
                }
            }

            if (data.routes.back.length === 0) {
                done();
            }
        },
        // проверка на достаточное количество бонусов на карте
        checkBonusesInCards = table => {
            // счётчики
            let table_count,
                check_count,
                sum_card_count,
                all_card_count,
                all_cards = data.cards.available.concat(
                    data.cards.free,
                    data.cards.conversion
                ),
                total_cards = [];

            // перезапись данных стоимостей карт из таблицы
            for (
                table_count = 0;
                table_count < table.length;
                table_count += 1
            ) {
                // проверка на наличие уже существующей информации о карте
                for (
                    check_count = 0;
                    check_count < total_cards.length;
                    check_count += 1
                ) {
                    // если такой элемент найден
                    if (
                        Number(total_cards[check_count].id) ===
                        Number(table[table_count].params.card_id)
                    ) {
                        break;
                    }
                }

                if (check_count < total_cards.length) {
                    // если такой элемент найден
                    total_cards[check_count].sum_mile += Number(
                        table[table_count].mile
                    );
                } else {
                    // если такой элемент не найден
                    total_cards.push({
                        // идентификатор
                        id: Number(table[table_count].params.card_id),

                        // количество миль
                        sum_mile: Number(table[table_count].mile)
                    });
                }
            }

            // проверка на то, достаточно ли суммарной стоимости
            for (
                sum_card_count = 0;
                sum_card_count < total_cards.length;
                sum_card_count += 1
            ) {
                // ищем из всех карт нашу по идентификатору
                for (
                    all_card_count = 0;
                    all_card_count < all_cards.length;
                    all_card_count += 1
                ) {
                    // если такой элемент найден
                    if (
                        Number(total_cards[sum_card_count].id) ===
                        Number(all_cards[all_card_count].params.card_id)
                    ) {
                        // если бонусов на карте не достаточно, возращаем отрицательный результат
                        if (
                            Number(all_cards[all_card_count].params.bonus_cur) <
                            Number(total_cards[sum_card_count].sum_mile)
                        ) {
                            return false;
                        }
                    }
                }
            }

            return true;
        },
        // проверка результатов на существование похожего варианта
        checkArrayToUnique = variant => {
            // счётчики
            let array_count,
                variant_count_one,
                variant_count_two,
                indication_unique,
                tickets_count,
                tickets_variant = 0,
                cards_variant = 0,
                tickets_table = 0,
                cards_table = 0;

            // получение количества человек для узнаваемого варианта
            for (
                tickets_count = 0;
                tickets_count < variant.length;
                tickets_count += 1
            ) {
                tickets_variant += variant[tickets_count].tickets;
                cards_variant += variant[tickets_count].converted_cards.length;
            }

            for (
                array_count = 0;
                array_count < data.result.unsorted.length;
                array_count += 1
            ) {
                tickets_table = 0;
                cards_table = 0;

                // получение количества человек для имеющегося варианта
                for (
                    tickets_count = 0;
                    tickets_count <
                    data.result.unsorted[array_count].variant.length;
                    tickets_count += 1
                ) {
                    tickets_table +=
                        data.result.unsorted[array_count].variant[tickets_count]
                            .tickets;
                    cards_table +=
                        data.result.unsorted[array_count].variant[tickets_count]
                            .converted_cards.length;
                }

                if (
                    (tickets_variant <= tickets_table &&
                        variant.length >
                            data.result.unsorted[array_count].variant.length) ||
                    (cards_variant > cards_table &&
                        tickets_variant == tickets_table)
                ) {
                    return false;
                }

                // если размер одинаковый, выполняем проверки на уникальность
                if (
                    data.result.unsorted[array_count].variant.length ===
                    variant.length
                ) {
                    // индикатор уникальностей элемента
                    indication_unique = variant.length;

                    for (
                        variant_count_one = 0;
                        variant_count_one <
                        data.result.unsorted[array_count].variant.length;
                        variant_count_one += 1
                    ) {
                        for (
                            variant_count_two = 0;
                            variant_count_two < variant.length;
                            variant_count_two += 1
                        ) {
                            // проверка на совпадение каждого варианта
                            if (
                                data.result.unsorted[array_count].variant[
                                    variant_count_one
                                ].card === variant[variant_count_two].card &&
                                data.result.unsorted[array_count].variant[
                                    variant_count_one
                                ].params.card_id ===
                                    variant[variant_count_two].params.card_id &&
                                data.result.unsorted[array_count].variant[
                                    variant_count_one
                                ].airline ===
                                    variant[variant_count_two].airline &&
                                (data.result.unsorted[array_count].variant[
                                    variant_count_one
                                ].from === variant[variant_count_two].from ||
                                    data.result.unsorted[array_count].variant[
                                        variant_count_one
                                    ].from === variant[variant_count_two].to) &&
                                (data.result.unsorted[array_count].variant[
                                    variant_count_one
                                ].to === variant[variant_count_two].to ||
                                    data.result.unsorted[array_count].variant[
                                        variant_count_one
                                    ].to === variant[variant_count_two].from) &&
                                data.result.unsorted[array_count].variant[
                                    variant_count_one
                                ].have === variant[variant_count_two].have
                            ) {
                                // если элемент совпал, уменьшаем процент уникальности
                                indication_unique -= 1;
                                break;
                            }
                        }
                    }

                    // если объект не уникальный
                    if (!indication_unique) {
                        return false;
                    }
                }
            }

            return true;
        },
        // проверка на повторяемость карт в одной цепочке
        checkRepeatabilityCards = table => {
            let count_table_one,
                count_table_two,
                count_converted_cards,
                converted_id = [];

            // проверка на использование одной и той же карты для конвертации
            for (
                count_table_one = 0;
                count_table_one < table.length;
                count_table_one += 1
            ) {
                for (
                    count_converted_cards = 0;
                    count_converted_cards <
                    table[count_table_one].converted_cards.length;
                    count_converted_cards += 1
                ) {
                    if (
                        converted_id.indexOf(
                            Number(
                                table[count_table_one].converted_cards[
                                    count_converted_cards
                                ].params.card_id
                            )
                        ) === -1
                    ) {
                        converted_id.push(
                            Number(
                                table[count_table_one].converted_cards[
                                    count_converted_cards
                                ].params.card_id
                            )
                        );
                    }
                }
            }

            // проверка на использование одной и той же карточки несколько раз в одну сторону
            for (
                count_table_one = 0;
                count_table_one < table.length;
                count_table_one += 1
            ) {
                for (
                    count_table_two = count_table_one + 1;
                    count_table_two < table.length;
                    count_table_two += 1
                ) {
                    if (
                        (Number(table[count_table_one].card_id) ===
                            Number(table[count_table_two].card_id) &&
                            String(table[count_table_one].card_id) !==
                                String(table[count_table_two].card_id)) ||
                        converted_id.indexOf(
                            Number(table[count_table_one].card_id)
                        ) !== -1
                    ) {
                        return false;
                    }

                    if (
                        Number(
                            table[count_table_one].params.converted_from_card
                        ) ===
                            Number(
                                table[count_table_two].params
                                    .converted_from_card
                            ) &&
                        Boolean(table[count_table_one].conversion) !==
                            Boolean(table[count_table_two].conversion)
                    ) {
                        return false;
                    }

                    // проверка на использование одной и той же карточки несколько раз в разных картах
                    if (
                        Number(table[count_table_one].params.card_id) !==
                        Number(table[count_table_two].card_id)
                    ) {
                        for (
                            count_converted_cards = 0;
                            count_converted_cards <
                            table[count_table_one].converted_cards.length;
                            count_converted_cards += 1
                        ) {
                            if (
                                converted_id.indexOf(
                                    Number(
                                        table[count_table_one].converted_cards[
                                            count_converted_cards
                                        ].params.card_id
                                    )
                                ) !== -1
                            ) {
                                return false;
                            }
                        }
                    }
                }
            }

            return true;
        },
        // рекурсивный алгоритм обработки данных
        calcRecursive = (
            combined_array,
            step,
            bounding_count,
            recursion_depth_computation,
            temp_array,
            temp_array_params,
            criterion_calc,
            need_tickets,
            done
        ) => {
            // проверка на конец глубины рекурсии
            if (
                step === recursion_depth_computation ||
                data.result.unsorted.length >=
                    config.max_variants_recursion_computation
            ) {
                return;
            }

            let array_count,
                table_count,
                table = [],
                tickets;

            for (
                array_count = bounding_count;
                array_count < combined_array.length;
                array_count += 1
            ) {
                //---------------- увеличение счётчика проверенных комбинаций -------------------//
                if (
                    data.result.unsorted.length <
                    config.max_variants_recursion_computation
                ) {
                    data.result.treated_combinations += 1;
                }

                //---------------- добавление элемента во временный массив -------------------//
                temp_array.push(combined_array[array_count]);

                //---------------- добавление параметров ------------------//
                temp_array_params.sum_amount += Number(
                    combined_array[array_count].params.amount
                );
                temp_array_params.sum_fee1 += Number(
                    combined_array[array_count].params.fee1
                );
                temp_array_params.sum_tickets_direct += Number(
                    combined_array[array_count].tickets_direct
                );
                temp_array_params.sum_tickets_back += Number(
                    combined_array[array_count].tickets_back
                );

                //---------------- проверка результата -------------------//

                // критерий карты для траты меньше 3-х месяцев
                if (
                    temp_array_params.sum_amount + temp_array_params.sum_fee1 <=
                        criterion_calc.amount_min &&
                    temp_array_params.sum_tickets_direct >=
                        criterion_calc.min_people &&
                    temp_array_params.sum_tickets_back >=
                        criterion_calc.min_people &&
                    temp_array_params.sum_tickets_direct <=
                        criterion_calc.max_people &&
                    temp_array_params.sum_tickets_back <=
                        criterion_calc.max_people &&
                    temp_array_params.sum_tickets_direct ===
                        temp_array_params.sum_tickets_back &&
                    temp_array_params.sum_tickets_direct === need_tickets
                ) {
                    // формирование объекта
                    for (
                        table_count = 0;
                        table_count < temp_array.length;
                        table_count += 1
                    ) {
                        if (temp_array[table_count].tickets_direct) {
                            tickets = Number(
                                temp_array[table_count].tickets_direct
                            );
                        } else {
                            tickets = Number(
                                temp_array[table_count].tickets_back
                            );
                        }

                        table.push({
                            card: String(temp_array[table_count].card),

                            card_id: Number(temp_array[table_count].card_id),

                            airline: String(temp_array[table_count].airline),

                            from: String(temp_array[table_count].from),

                            to: String(temp_array[table_count].to),

                            fee1: Number(temp_array[table_count].fee1),

                            amount: Number(temp_array[table_count].amount),

                            price_of_one_ticket: Number(
                                temp_array[table_count].price_of_one_ticket
                            ),

                            mile: Number(temp_array[table_count].mile),

                            available_amount_of_bonuses: Number(
                                temp_array[table_count]
                                    .available_amount_of_bonuses
                            ),

                            tickets: Number(tickets),

                            link: String(temp_array[table_count].link),

                            image: String(temp_array[table_count].image),

                            have: Boolean(temp_array[table_count].have),

                            params: temp_array[table_count].params,

                            converted_cards:
                                temp_array[table_count].converted_cards,

                            conversion: Boolean(
                                temp_array[table_count].conversion
                            ),

                            direct: Boolean(temp_array[table_count].direct)
                        });
                    }

                    // проверка на достаточное количество бонусов каждой карты и на уникальность варианта
                    if (
                        checkRepeatabilityCards(table) &&
                        checkBonusesInCards(table) &&
                        checkArrayToUnique(table)
                    ) {
                        // добавление объекта
                        data.result.unsorted.push({
                            variant: table.slice(),
                            text: null
                        });
                    }

                    // очистка массива
                    table.splice(0, table.length);
                } else {
                    // критерий карты для траты меньше 12-х месяцев
                    if (
                        temp_array_params.sum_amount +
                            temp_array_params.sum_fee1 <=
                            criterion_calc.amount_max &&
                        temp_array_params.sum_tickets_direct >=
                            criterion_calc.min_people &&
                        temp_array_params.sum_tickets_back >=
                            criterion_calc.min_people &&
                        temp_array_params.sum_tickets_direct <=
                            criterion_calc.max_people &&
                        temp_array_params.sum_tickets_back <=
                            criterion_calc.max_people &&
                        temp_array_params.sum_tickets_direct ===
                            temp_array_params.sum_tickets_back &&
                        temp_array_params.sum_tickets_direct === need_tickets
                    ) {
                        // формирование объекта
                        for (
                            table_count = 0;
                            table_count < temp_array.length;
                            table_count += 1
                        ) {
                            if (temp_array[table_count].tickets_direct) {
                                tickets = Number(
                                    temp_array[table_count].tickets_direct
                                );
                            } else {
                                tickets = Number(
                                    temp_array[table_count].tickets_back
                                );
                            }

                            table.push({
                                card: String(temp_array[table_count].card),

                                card_id: Number(
                                    temp_array[table_count].card_id
                                ),

                                airline: String(
                                    temp_array[table_count].airline
                                ),

                                from: String(temp_array[table_count].from),

                                to: String(temp_array[table_count].to),

                                fee1: Number(temp_array[table_count].fee1),

                                amount: Number(temp_array[table_count].amount),

                                price_of_one_ticket: Number(
                                    temp_array[table_count].price_of_one_ticket
                                ),

                                mile: Number(temp_array[table_count].mile),

                                available_amount_of_bonuses: Number(
                                    temp_array[table_count]
                                        .available_amount_of_bonuses
                                ),

                                tickets: Number(tickets),

                                link: String(temp_array[table_count].link),

                                image: String(temp_array[table_count].image),

                                have: Boolean(temp_array[table_count].have),

                                params: temp_array[table_count].params,

                                converted_cards:
                                    temp_array[table_count].converted_cards,

                                conversion: Boolean(
                                    temp_array[table_count].conversion
                                ),

                                direct: Boolean(temp_array[table_count].direct)
                            });
                        }

                        // проверка на достаточное количество бонусов каждой карты и на уникальность варианта
                        if (
                            checkRepeatabilityCards(table) &&
                            checkBonusesInCards(table) &&
                            checkArrayToUnique(table)
                        ) {
                            // добавление объекта
                            data.result.unsorted.push({
                                variant: table.slice(),
                                low: true
                            });
                        }

                        // очистка массива
                        table.splice(0, table.length);
                    }
                }

                //---------------- вызов рекурсии -----------------------//
                calcRecursive(
                    combined_array,
                    step + 1,
                    (bounding_count += 1),
                    recursion_depth_computation,
                    temp_array,
                    temp_array_params,
                    criterion_calc,
                    need_tickets,
                    done
                );

                //---------------- удаление параметров ------------------//
                temp_array_params.sum_amount -= Number(
                    combined_array[array_count].params.amount
                );
                temp_array_params.sum_fee1 -= Number(
                    combined_array[array_count].params.fee1
                );
                temp_array_params.sum_tickets_direct -= Number(
                    combined_array[array_count].tickets_direct
                );
                temp_array_params.sum_tickets_back -= Number(
                    combined_array[array_count].tickets_back
                );

                //---------------- удаление элемента с временного массива -------------------//
                temp_array.pop();

                //---------------- проверка на достаточное количество найденных вариантов -------------------//
                if (
                    data.result.unsorted.length >
                    config.max_variants_recursion_computation
                ) {
                    break;
                }
            }
        },
        // алгоритм сортировки стоимостей
        sortCostAlhoritm = (cost_one, cost_two) => {
            // сравнение двух стоимостей по параметрам
            if (
                Number(cost_one.tickets_direct + cost_one.tickets_back) !==
                Number(cost_two.tickets_direct + cost_two.tickets_back)
            ) {
                if (
                    Number(cost_one.tickets_direct + cost_one.tickets_back) >
                    Number(cost_two.tickets_direct + cost_two.tickets_back)
                ) {
                    return -1;
                }
                if (
                    Number(cost_one.tickets_direct + cost_one.tickets_back) <
                    Number(cost_two.tickets_direct + cost_two.tickets_back)
                ) {
                    return 1;
                }
            }

            if (
                Number(cost_one.converted_cards.length) !==
                Number(cost_two.converted_cards.length)
            ) {
                if (
                    Number(cost_one.converted_cards.length) <
                    Number(cost_two.converted_cards.length)
                ) {
                    return -1;
                }
                if (
                    Number(cost_one.converted_cards.length) >
                    Number(cost_two.converted_cards.length)
                ) {
                    return 1;
                }
            }

            if (
                Number(cost_one.converted_cards.bonus_cur) !==
                Number(cost_two.converted_cards.bonus_cur)
            ) {
                if (
                    Number(cost_one.converted_cards.bonus_cur) >
                    Number(cost_two.converted_cards.bonus_cur)
                ) {
                    return -1;
                }
                if (
                    Number(cost_one.converted_cards.bonus_cur) <
                    Number(cost_two.converted_cards.bonus_cur)
                ) {
                    return 1;
                }
            }

            if (
                Number(cost_one.converted_cards.fee1) !==
                Number(cost_two.converted_cards.fee1)
            ) {
                if (
                    Number(cost_one.converted_cards.fee1) <
                    Number(cost_two.converted_cards.fee1)
                ) {
                    return -1;
                }
                if (
                    Number(cost_one.converted_cards.fee1) >
                    Number(cost_two.converted_cards.fee1)
                ) {
                    return -1;
                }
            }

            return 0;
        },
        // конечное вычисление данных
        calcResultData = done => {
            // слияние массивов с ценами по отсортированому порядку
            let combined_array = data.routes_cost.available.direct
                    .sort(sortCostAlhoritm)
                    .concat(
                        data.routes_cost.available.back.sort(sortCostAlhoritm),
                        data.routes_cost.free.direct.sort(sortCostAlhoritm),
                        data.routes_cost.free.back.sort(sortCostAlhoritm),
                        data.routes_cost.conversion.direct.sort(
                            sortCostAlhoritm
                        ),
                        data.routes_cost.conversion.back.sort(sortCostAlhoritm)
                    ),
                // критерии расчёта
                criterion_calc = {
                    amount_min: Number(params.spendNextMonth) * 3,
                    amount_max: Number(
                        params.spendNextMonth * 3 +
                            (params.spendNextYear -
                                params.spendNextMonth * 12) *
                                0.5
                    ),
                    min_people:
                        Number(params.minPeople) + Number(params.statusValue),
                    max_people:
                        Number(params.maxPeople) + Number(params.statusValue)
                },
                // слияние всех карт
                all_cards = data.cards.available.concat(
                    data.cards.free,
                    data.cards.conversion
                ),
                // счётчик глубины рекурсии
                depth_count,
                // счётчик билетов
                tickets_count;

            // определение разного числа людей, от большего к меньшему
            for (
                tickets_count = criterion_calc.max_people;
                tickets_count >= criterion_calc.min_people;
                tickets_count -= 1
            ) {
                // определение комбинаций карт для разного числа людей, от меньшего к большему
                for (
                    depth_count = 1;
                    depth_count <= config.recursion_depth_computation;
                    depth_count += 1
                ) {
                    // проверка наличия данных в результате, если данных нету, ищем большую комбинацию
                    if (!data.result.unsorted.length) {
                        // вызов рекурсии для поиска n-ной комбинации карт
                        calcRecursive(
                            combined_array,
                            0,
                            0,
                            depth_count,
                            [],
                            {
                                sum_amount: 0,
                                sum_fee1: 0,
                                sum_tickets_direct: 0,
                                sum_tickets_back: 0
                            },
                            criterion_calc,
                            tickets_count,
                            done
                        );
                    } else {
                        break;
                    }
                }

                if (
                    depth_count !== config.recursion_depth_computation + 1 ||
                    tickets_count === criterion_calc.min_people
                ) {
                    done();
                    break;
                }
            }
        },
        // алгоритм сортировки результата
        sortResultAlgoritm = (table_one, table_two) => {
            let variant_count,
                conversion_count,
                variant_one_tickets = 0,
                variant_two_tickets = 0,
                variant_one_have = 0,
                variant_two_have = 0,
                variant_one_fee1 = 0,
                variant_two_fee1 = 0,
                variant_one_cards = [],
                variant_two_cards = [];

            // подсчёт количества билетов, комиссии и карт, которых есть
            for (
                variant_count = 0;
                variant_count < table_one.variant.length;
                variant_count += 1
            ) {
                variant_one_tickets += Number(
                    table_one.variant[variant_count].tickets
                );
                variant_one_have += Number(
                    table_one.variant[variant_count].have
                );
                variant_one_fee1 += Number(
                    table_one.variant[variant_count].params.fee1
                );
            }

            for (
                variant_count = 0;
                variant_count < table_two.variant.length;
                variant_count += 1
            ) {
                variant_two_tickets += Number(
                    table_two.variant[variant_count].tickets
                );
                variant_two_have += Number(
                    table_two.variant[variant_count].have
                );
                variant_two_fee1 += Number(
                    table_two.variant[variant_count].params.fee1
                );
            }

            // подсчёт количества карт
            for (
                variant_count = 0;
                variant_count < table_one.variant.length;
                variant_count += 1
            ) {
                // подсчёт карт, используемых для преобразования
                for (
                    conversion_count = 0;
                    conversion_count <
                    table_one.variant[variant_count].converted_cards.length;
                    conversion_count += 1
                ) {
                    // если такая карта ещё не учтена, запоминаем её
                    if (
                        variant_one_cards.indexOf(
                            Number(
                                table_one.variant[variant_count]
                                    .converted_cards[conversion_count].params
                                    .card_id
                            )
                        ) === -1
                    ) {
                        variant_one_cards.push(
                            Number(
                                table_one.variant[variant_count]
                                    .converted_cards[conversion_count].params
                                    .card_id
                            )
                        );

                        if (
                            Boolean(
                                table_one.variant[variant_count]
                                    .converted_cards[conversion_count].card.have
                            )
                        ) {
                            variant_one_have += Number(
                                Number(
                                    table_one.variant[variant_count]
                                        .converted_cards[conversion_count].card
                                        .have
                                )
                            );
                        }
                    }
                }

                // если такая карта ещё не учтена, запоминаем её
                if (
                    variant_one_cards.indexOf(
                        Number(table_one.variant[variant_count].params.card_id)
                    ) === -1
                ) {
                    variant_one_cards.push(
                        Number(table_one.variant[variant_count].params.card_id)
                    );
                }
            }

            for (
                variant_count = 0;
                variant_count < table_two.variant.length;
                variant_count += 1
            ) {
                // подсчёт карт, используемых для преобразования
                for (
                    conversion_count = 0;
                    conversion_count <
                    table_two.variant[variant_count].converted_cards.length;
                    conversion_count += 1
                ) {
                    // если такая карта ещё не учтена, запоминаем её
                    if (
                        variant_two_cards.indexOf(
                            Number(
                                table_two.variant[variant_count]
                                    .converted_cards[conversion_count].params
                                    .card_id
                            )
                        ) === -1
                    ) {
                        variant_two_cards.push(
                            Number(
                                table_two.variant[variant_count]
                                    .converted_cards[conversion_count].params
                                    .card_id
                            )
                        );

                        if (
                            Boolean(
                                table_two.variant[variant_count]
                                    .converted_cards[conversion_count].card.have
                            )
                        ) {
                            variant_two_have += Number(
                                table_two.variant[variant_count]
                                    .converted_cards[conversion_count].card.have
                            );
                        }
                    }
                }

                // если такая карта ещё не учтена, запоминаем её
                if (
                    variant_two_cards.indexOf(
                        Number(table_two.variant[variant_count].params.card_id)
                    ) === -1
                ) {
                    variant_two_cards.push(
                        Number(table_two.variant[variant_count].params.card_id)
                    );
                }
            }

            // сравнение двух вариантов по параметрам
            if (Number(variant_one_tickets) !== Number(variant_two_tickets)) {
                if (Number(variant_one_tickets) > Number(variant_two_tickets)) {
                    return -1;
                }
                if (Number(variant_one_tickets) < Number(variant_two_tickets)) {
                    return 1;
                }
            }

            if (
                Number(variant_one_cards.length) !==
                Number(variant_two_cards.length)
            ) {
                if (Number(variant_one_fee1) === Number(variant_two_fee1)) {
                    if (
                        Number(variant_one_cards.length) <
                        Number(variant_two_cards.length)
                    ) {
                        return -1;
                    }
                    if (
                        Number(variant_one_cards.length) >
                        Number(variant_two_cards.length)
                    ) {
                        return 1;
                    }
                }

                if (
                    Number(variant_one_cards.length) <
                        Number(variant_two_cards.length) &&
                    Number(variant_one_fee1) < Number(variant_two_fee1)
                ) {
                    return -1;
                }

                if (
                    Number(variant_one_cards.length) >
                        Number(variant_two_cards.length) &&
                    Number(variant_one_fee1) < Number(variant_two_fee1)
                ) {
                    if (
                        Number(variant_one_fee1) <=
                        Number(params.consts.twoStageSorting)
                    ) {
                        return -1;
                    }
                    if (
                        Number(variant_one_fee1) >
                        Number(params.consts.twoStageSorting)
                    ) {
                        return 1;
                    }
                }

                if (
                    Number(variant_one_cards.length) <
                        Number(variant_two_cards.length) &&
                    Number(variant_one_fee1) > Number(variant_two_fee1)
                ) {
                    if (
                        Number(variant_one_fee1) <=
                        Number(params.consts.twoStageSorting)
                    ) {
                        return -1;
                    }
                    if (
                        Number(variant_one_fee1) >
                        Number(params.consts.twoStageSorting)
                    ) {
                        return 1;
                    }
                }

                if (
                    Number(variant_one_cards.length) >
                        Number(variant_two_cards.length) &&
                    Number(variant_one_fee1) > Number(variant_two_fee1)
                ) {
                    return 1;
                }
            }

            if (Number(variant_one_fee1) !== Number(variant_two_fee1)) {
                if (Number(variant_one_fee1) < Number(variant_two_fee1)) {
                    return -1;
                }
                if (Number(variant_one_fee1) > Number(variant_two_fee1)) {
                    return 1;
                }
            }

            if (Number(variant_one_have) !== Number(variant_two_have)) {
                if (Number(variant_one_have) > Number(variant_two_have)) {
                    return -1;
                }
                if (Number(variant_one_have) < Number(variant_two_have)) {
                    return 1;
                }
            }

            return 0;
        },
        // алгоритм сортировки карт
        sortAlhoritmCards = (card_one, card_two) => {
            // сравнение двух карт по параметрам
            if (
                Number(card_one.converted_cards.length) !==
                Number(card_two.converted_cards.length)
            ) {
                if (
                    Number(card_one.converted_cards.length) <
                    Number(card_two.converted_cards.length)
                ) {
                    return -1;
                }
                if (
                    Number(card_one.converted_cards.length) >
                    Number(card_two.converted_cards.length)
                ) {
                    return 1;
                }
            }

            if (
                Number(card_one.params.bonus_cur) !==
                Number(card_two.params.bonus_cur)
            ) {
                if (
                    Number(card_one.params.bonus_cur) >
                    Number(card_two.params.bonus_cur)
                ) {
                    return -1;
                }
                if (
                    Number(card_one.params.bonus_cur) <
                    Number(card_two.params.bonus_cur)
                ) {
                    return 1;
                }
            }

            if (Number(card_one.params.fee1) !== Number(card_two.params.fee1)) {
                if (
                    Number(card_one.params.fee1) < Number(card_two.params.fee1)
                ) {
                    return -1;
                }
                if (
                    Number(card_one.params.fee1) > Number(card_two.params.fee1)
                ) {
                    return 1;
                }
            }

            return 0;
        },
        // преобразование конечных данных
        adaptResultData = done => {
            let cards_count,
                variant_count,
                converted_count,
                cards_id = [],
                variant,
                direct_count,
                back_count;

            // перезапись
            data.result.sorted = JSON.parse(
                JSON.stringify(data.result.unsorted)
            );

            // сортировка
            data.result.sorted.sort(sortResultAlgoritm);

            // изменение количества отдаваемых результатов
            if (data.result.sorted.length > config.max_variants) {
                data.result.sorted.length = config.max_variants;
            }

            // проверка карт на повторения
            for (
                cards_count = 0;
                cards_count < data.result.sorted.length;
                cards_count += 1
            ) {
                // проверка главных карт
                for (
                    variant_count = 0;
                    variant_count <
                    data.result.sorted[cards_count].variant.length;
                    variant_count += 1
                ) {
                    if (
                        cards_id.indexOf(
                            Number(
                                data.result.sorted[cards_count].variant[
                                    variant_count
                                ].card_id
                            )
                        ) === -1
                    ) {
                        cards_id.push(
                            Number(
                                data.result.sorted[cards_count].variant[
                                    variant_count
                                ].card_id
                            )
                        );
                    } else {
                        data.result.sorted[cards_count].variant[
                            variant_count
                        ].card +=
                            " (Same card)";
                        data.result.sorted[cards_count].variant[
                            variant_count
                        ].fee1 = data.result.sorted[cards_count].variant[
                            variant_count
                        ].amount =
                            "-";
                    }

                    // проверка на имеющуюся карту
                    if (
                        data.result.sorted[cards_count].variant[variant_count]
                            .have
                    ) {
                        data.result.sorted[cards_count].variant[
                            variant_count
                        ].fee1 = data.result.sorted[cards_count].variant[
                            variant_count
                        ].amount =
                            "-";
                    }

                    // проверка используемых для преобразования карт
                    for (
                        converted_count = 0;
                        converted_count <
                        data.result.sorted[cards_count].variant[variant_count]
                            .converted_cards.length;
                        converted_count += 1
                    ) {
                        if (
                            cards_id.indexOf(
                                Number(
                                    data.result.sorted[cards_count].variant[
                                        variant_count
                                    ].converted_cards[converted_count].params
                                        .card_id
                                )
                            ) === -1
                        ) {
                            cards_id.push(
                                Number(
                                    data.result.sorted[cards_count].variant[
                                        variant_count
                                    ].converted_cards[converted_count].params
                                        .card_id
                                )
                            );
                        } else {
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ].converted_cards[converted_count].card.name +=
                                " (Same card)";
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ].converted_cards[
                                converted_count
                            ].params.fee1 = data.result.sorted[
                                cards_count
                            ].variant[variant_count].converted_cards[
                                converted_count
                            ].params.amount =
                                "-";
                        }

                        // проверка на имеющуюся карту
                        if (
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ].converted_cards[converted_count].card.have
                        ) {
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ].converted_cards[
                                converted_count
                            ].params.fee1 = data.result.sorted[
                                cards_count
                            ].variant[variant_count].converted_cards[
                                converted_count
                            ].params.amount =
                                "-";
                        }
                    }
                }

                // очистка идентификаторов повторяющихся карт
                cards_id.splice(0, cards_id.length);
            }

            // разделение по прямым/обратным рейсам
            for (
                cards_count = 0;
                cards_count < data.result.sorted.length;
                cards_count += 1
            ) {
                // создание структуры объекта
                variant = {
                    direct: {
                        info: {
                            total_ticket_price_in_miles: 0,
                            total_miles_available_on_all_cards: 0
                        },

                        variants: []
                    },

                    back: {
                        info: {
                            total_ticket_price_in_miles: 0,
                            total_miles_available_on_all_cards: 0
                        },

                        variants: []
                    }
                };

                // проверка главных карт
                for (
                    variant_count = 0;
                    variant_count <
                    data.result.sorted[cards_count].variant.length;
                    variant_count += 1
                ) {
                    if (
                        Boolean(
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ].direct
                        )
                    ) {
                        // добавление элемента
                        variant.direct.variants.push(
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ]
                        );

                        // изменение данных
                        variant.direct.info.total_ticket_price_in_miles += Number(
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ].mile
                        );
                        variant.direct.info.total_miles_available_on_all_cards += Number(
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ].params.bonus_cur
                        );
                    } else {
                        // добавление элемента
                        variant.back.variants.push(
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ]
                        );

                        // изменение данных
                        variant.back.info.total_ticket_price_in_miles += Number(
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ].mile
                        );
                        variant.back.info.total_miles_available_on_all_cards += Number(
                            data.result.sorted[cards_count].variant[
                                variant_count
                            ].params.bonus_cur
                        );
                    }

                    // высчитываем мили, которые использовались для полёта в прямом направлении
                    for (
                        back_count = 0;
                        back_count < variant.back.variants.length;
                        back_count += 1
                    ) {
                        for (
                            direct_count = 0;
                            direct_count < variant.back.variants.length;
                            direct_count += 1
                        ) {
                            if (
                                Number(
                                    variant.back.variants[back_count].card_id
                                ) ===
                                Number(
                                    variant.direct.variants[direct_count]
                                        .card_id
                                )
                            ) {
                                variant.back.info.total_miles_available_on_all_cards -= Number(
                                    variant.direct.variants[direct_count].mile
                                );
                            }
                        }
                    }
                }

                data.result.separated.push(JSON.parse(JSON.stringify(variant)));
            }

            done();
        };

    // обращение к БД
    database.getConnection((error, conn) => {
        if (error) {
            log.fatal("Error MySQL connection: " + error);
        } else {
            async.parallel(
                [
                    // получение прямых рейсов
                    done => {
                        selectDirectRoutes(conn, done);
                    },

                    // получение обратных рейсов
                    done => {
                        selectBackRoutes(conn, done);
                    }
                ],
                () => {
                    async.series(
                        [
                            // определение разрешённых авиалиний карт для прямых рейсов
                            done => {
                                identifyAirlinesForDirect(done);
                            },

                            // определение разрешённых авиалиний карт для обратных рейсов
                            done => {
                                identifyAirlinesForBack(done);
                            }
                        ],
                        () => {
                            async.series(
                                [
                                    done => {
                                        async.parallel(
                                            [
                                                // расчёт стоимостей имеющихся карт
                                                done => {
                                                    async.series(
                                                        [
                                                            done => {
                                                                selectAvailableCards(
                                                                    conn,
                                                                    done
                                                                );
                                                            },

                                                            done => {
                                                                calcCostAvailableCards(
                                                                    conn,
                                                                    done
                                                                );
                                                            }
                                                        ],
                                                        () => {
                                                            done();
                                                        }
                                                    );
                                                },

                                                // расчёт стоимостей свободных карт
                                                done => {
                                                    async.series(
                                                        [
                                                            done => {
                                                                selectFreeCards(
                                                                    conn,
                                                                    done
                                                                );
                                                            },

                                                            done => {
                                                                calcCostFreeCards(
                                                                    conn,
                                                                    done
                                                                );
                                                            }
                                                        ],
                                                        () => {
                                                            done();
                                                        }
                                                    );
                                                }
                                            ],
                                            () => {
                                                done();
                                            }
                                        );
                                    },

                                    // расчёт стоимостей преобразованных карт
                                    done => {
                                        async.series(
                                            [
                                                done => {
                                                    cards_module.selectConversion(
                                                        config,
                                                        conn,
                                                        data.cards.free
                                                            .slice()
                                                            .concat(
                                                                data.cards
                                                                    .available
                                                            ),
                                                        params.allCards,
                                                        params.amExCards,
                                                        data.authorized_airlines,
                                                        log,
                                                        async,
                                                        cards_conversion => {
                                                            // сортировка карт
                                                            cards_conversion.sort(
                                                                sortAlhoritmCards
                                                            );

                                                            // изменение количества отдаваемых результатов
                                                            if (
                                                                cards_conversion.length >
                                                                config.max_variants_recursion_conversion
                                                            ) {
                                                                cards_conversion.length =
                                                                    config.max_variants_recursion_conversion;
                                                            }

                                                            data.cards.conversion = cards_conversion;

                                                            done();
                                                        }
                                                    );
                                                },

                                                done => {
                                                    cards_module.calcCostConversionCards(
                                                        data,
                                                        params,
                                                        () => {
                                                            done();
                                                        }
                                                    );
                                                }
                                            ],
                                            () => {
                                                done();
                                            }
                                        );
                                    }
                                ],
                                () => {
                                    async.series(
                                        [
                                            // высчитывание окончательных данных
                                            done => {
                                                calcResultData(done);
                                            },

                                            // сортировка окончательных данных
                                            done => {
                                                adaptResultData(done);
                                            }
                                        ],
                                        () => {
                                            // возврат результата
                                            callback(null, {
                                                results: data.result.separated,
                                                number_of_cards: Number(
                                                    data.cards.conversion
                                                        .length +
                                                        data.cards.free.length +
                                                        data.cards.conversion
                                                            .length
                                                ),
                                                treated_combinations:
                                                    data.result
                                                        .treated_combinations
                                            });

                                            // закрытие запроса
                                            conn.release();
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    });
};
