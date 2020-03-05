import { Module } from '@nestjs/common';
import { BootModule, Boot } from '@nestcloud/boot';
import { ConsulModule } from '@nestcloud/consul';
import { ConfigModule } from '@nestcloud/config';
import { ServiceModule } from '@nestcloud/service';
import { LoadbalanceModule } from '@nestcloud/loadbalance';
import { HttpModule } from '@nestcloud/http';
import {
  BOOT,
  LOADBALANCE,
  components,
  repositories,
  CONSUL,
} from '@nestcloud/common';
import { TypeOrmHealthIndicator, TerminusModule, TerminusModuleOptions } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

import * as controllers from './controllers';
import * as repos from './repositories';
import * as services from './services';
import * as clients from './clients';
import { LoggerModule, TypeormLogger, TYPEORM_LOGGER } from '@nestcloud/logger';
import { resolve } from 'path';

const getTerminusOptions = (db: TypeOrmHealthIndicator): TerminusModuleOptions => ({
  endpoints: [
    {
      url: '/health',
      healthIndicators: [
        async () => db.pingCheck('database', { timeout: 300 }),
      ],
    },
  ],
});

@Module({
  imports: [
    LoggerModule.forRoot(),
    BootModule.forRoot({ filePath: resolve(__dirname, 'config.yaml') }),
    ConsulModule.forRootAsync({ inject: [BOOT] }),
    ConfigModule.forRootAsync({ inject: [BOOT, CONSUL] }),
    ServiceModule.forRootAsync({ inject: [BOOT, CONSUL] }),
    LoadbalanceModule.forRootAsync({ inject: [BOOT] }),
    HttpModule.forRootAsync({ inject: [LOADBALANCE] }),
    TerminusModule.forRootAsync({
      inject: [TypeOrmHealthIndicator],
      useFactory: db => getTerminusOptions(db as TypeOrmHealthIndicator),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: Boot, logger: TypeormLogger) => {
        return ({
          type: 'mysql',
          host: config.get('dataSource.host', 'localhost'),
          port: config.get('dataSource.port', 3306),
          username: config.get('dataSource.username', 'root'),
          password: config.get('dataSource.password', 'my-secret-pw'),
          database: config.get('dataSource.database', 'nestcloud'),
          entities: [__dirname + '/entities/*{.ts,.js}'],
          synchronize: config.get('dataSource.synchronize', false),
          maxQueryExecutionTime: config.get('dataSource.maxQueryExecutionTime', 1000),
          logging: ['error', 'warn'],
          logger,
        });
      },
      inject: [BOOT, TYPEORM_LOGGER],
    }),
  ],
  controllers: components(controllers),
  providers: components(repositories(repos), services, clients),
})
export class AppModule {
}
