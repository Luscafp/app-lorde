import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { aposCommit } from './apos-commit'
import type { EventosDominio, NomeEventoDominio, PayloadBase } from './eventos-dominio'

/** Único meio de emitir eventos de domínio: só depois do commit (convenções §8). */
@Injectable()
export class EventosDominioService {
  constructor(private readonly emissor: EventEmitter2) {}

  emitirAposCommit<K extends NomeEventoDominio>(
    nome: K,
    payload: EventosDominio[K] & PayloadBase,
  ): void {
    aposCommit(() => this.emissor.emit(nome, payload))
  }
}
