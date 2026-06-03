/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import createSagaMiddleware from 'redux-saga';
import { applyMiddleware, createStore } from 'redux';
import type { AnyAction, Store } from 'redux';
import rootReducer from './reducers';
import rootSaga    from './sagas';

export class IStore {
  private static store: Store | undefined;

  public static getStore(): Store<any, AnyAction> {
    if (!IStore.store) {
      const sagaMiddleware = createSagaMiddleware();
      const store = createStore(rootReducer, {}, applyMiddleware(sagaMiddleware));
      sagaMiddleware.run(rootSaga);
      IStore.store = store;
    }
    return IStore.store;
  }
}
