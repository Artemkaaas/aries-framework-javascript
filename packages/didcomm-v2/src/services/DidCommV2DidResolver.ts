import type { VerificationMethod, DidDocumentService } from '@aries-framework/core'
import type { DIDDoc, DIDResolver } from 'didcomm'

import {
  injectable,
  AgentContext,
  DidResolverService,
  DidCommV2Service,
  DidCommV1Service,
  IndyAgentService,
} from '@aries-framework/core'

@injectable()
export class DidCommV2DidResolver implements DIDResolver {
  private agentContext: AgentContext
  private didResolverService: DidResolverService

  public constructor(agentContext: AgentContext, didResolverService: DidResolverService) {
    this.agentContext = agentContext
    this.didResolverService = didResolverService
  }

  public async resolve(did: string): Promise<DIDDoc | null> {
    const result = await this.didResolverService.resolve(this.agentContext, did)
    if (!result.didDocument) {
      return null
    }

    const verificationMethods = result.didDocument.verificationMethod?.map((verificationMethod) =>
      DidCommV2DidResolver.mapVerificationMethod(verificationMethod)
    )

    const services = result.didDocument.service?.map((service) => DidCommV2DidResolver.mapService(service))

    const didDod: DIDDoc = {
      did: result.didDocument.id,
      verification_methods: verificationMethods || [],
      services: services || [],
      key_agreements: [],
      authentications: [],
    }

    const keyAgreements = result.didDocument.keyAgreement || []
    for (const keyAgreement of keyAgreements) {
      if (typeof keyAgreement === 'string') {
        didDod.key_agreements.push(keyAgreement)
      } else {
        didDod.key_agreements.push(keyAgreement.id)
        didDod.verification_methods.push(DidCommV2DidResolver.mapVerificationMethod(keyAgreement))
      }
    }

    const authentications = result.didDocument.authentication || []
    for (const authentication of authentications) {
      if (typeof authentication === 'string') {
        didDod.authentications.push(authentication)
      } else {
        didDod.authentications.push(authentication.id)
        didDod.verification_methods.push(DidCommV2DidResolver.mapVerificationMethod(authentication))
      }
    }

    return didDod
  }

  private static mapVerificationMethod(verificationMethod: VerificationMethod) {
    return {
      id: verificationMethod.id,
      type: verificationMethod.type,
      controller: verificationMethod.controller,
      verification_material: verificationMethod.publicKeyBase58
        ? { format: 'Base58', value: verificationMethod.publicKeyBase58 }
        : verificationMethod.publicKeyMultibase
        ? { format: 'Multibase', value: verificationMethod.publicKeyMultibase }
        : verificationMethod.publicKeyHex
        ? { format: 'Hex', value: verificationMethod.publicKeyHex }
        : verificationMethod.publicKeyJwk
        ? { format: 'JWK', value: verificationMethod.publicKeyJwk }
        : {
            format: 'Other',
            value:
              verificationMethod.publicKeyPem ||
              verificationMethod.publicKeyBase64 ||
              verificationMethod.blockchainAccountId ||
              verificationMethod.ethereumAddress,
          },
    }
  }

  private static mapService(service: DidDocumentService) {
    if (service instanceof DidCommV2Service) {
      return {
        id: service.id,
        kind: {
          DIDCommMessaging: {
            service_endpoint: service.serviceEndpoint,
            accept: service.accept ?? [],
            routing_keys: service.routingKeys ?? [],
          },
        },
      }
    } else if (service instanceof DidCommV1Service) {
      return {
        id: service.id,
        kind: {
          Other: {
            type: service.type,
            serviceEndpoint: service.serviceEndpoint,
            recipientKeys: service.recipientKeys || [],
            routingKeys: service.routingKeys,
            accept: service.accept,
            priority: service.priority,
          },
        },
      }
    } else if (service instanceof IndyAgentService) {
      return {
        id: service.id,
        kind: {
          Other: {
            type: service.type,
            serviceEndpoint: service.serviceEndpoint,
            recipientKeys: service.recipientKeys,
            routingKeys: service.routingKeys,
            priority: service.priority,
          },
        },
      }
    } else {
      return {
        id: service.id,
        kind: {
          Other: {
            type: service.type,
            serviceEndpoint: service.serviceEndpoint,
          },
        },
      }
    }
  }
}
