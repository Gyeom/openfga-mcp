import { getEnvironment } from './config.js';

export interface TupleKey {
  user: string;
  relation: string;
  object: string;
}

export interface Tuple {
  key: TupleKey;
  timestamp: string;
}

export interface Store {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthorizationModel {
  id: string;
  schema_version: string;
  type_definitions: any[];
}

export class OpenFGAClient {
  private baseUrl: string;
  private storeId: string;

  constructor(envName: string, storeId?: string) {
    const env = getEnvironment(envName);
    this.baseUrl = env.url;
    this.storeId = storeId || env.defaultStoreId || '';
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenFGA API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Store ID 자동 조회
  async resolveStoreId(): Promise<string> {
    if (this.storeId) {
      return this.storeId;
    }

    const stores = await this.listStores();
    if (stores.length === 0) {
      throw new Error('No stores found in this environment');
    }

    this.storeId = stores[0].id;
    return this.storeId;
  }

  // 스토어 목록 조회
  async listStores(): Promise<Store[]> {
    const result = await this.fetch<{ stores: Store[] }>('/stores');
    return result.stores || [];
  }

  // 권한 체크
  async check(user: string, relation: string, object: string): Promise<{ allowed: boolean }> {
    const storeId = await this.resolveStoreId();
    return this.fetch(`/stores/${storeId}/check`, {
      method: 'POST',
      body: JSON.stringify({
        tuple_key: { user, relation, object },
      }),
    });
  }

  // 튜플 조회
  async readTuples(filter?: Partial<TupleKey>): Promise<Tuple[]> {
    const storeId = await this.resolveStoreId();
    const body: any = {};
    if (filter) {
      body.tuple_key = filter;
    }

    const result = await this.fetch<{ tuples: Tuple[] }>(`/stores/${storeId}/read`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return result.tuples || [];
  }

  // 튜플 쓰기
  async writeTuples(tuples: TupleKey[]): Promise<void> {
    const storeId = await this.resolveStoreId();
    await this.fetch(`/stores/${storeId}/write`, {
      method: 'POST',
      body: JSON.stringify({
        writes: {
          tuple_keys: tuples,
        },
      }),
    });
  }

  // 튜플 삭제
  async deleteTuples(tuples: TupleKey[]): Promise<void> {
    const storeId = await this.resolveStoreId();
    await this.fetch(`/stores/${storeId}/write`, {
      method: 'POST',
      body: JSON.stringify({
        deletes: {
          tuple_keys: tuples,
        },
      }),
    });
  }

  // List Objects
  async listObjects(user: string, relation: string, type: string): Promise<string[]> {
    const storeId = await this.resolveStoreId();
    const result = await this.fetch<{ objects: string[] }>(`/stores/${storeId}/list-objects`, {
      method: 'POST',
      body: JSON.stringify({ user, relation, type }),
    });
    return result.objects || [];
  }

  // Expand
  async expand(relation: string, object: string): Promise<any> {
    const storeId = await this.resolveStoreId();
    return this.fetch(`/stores/${storeId}/expand`, {
      method: 'POST',
      body: JSON.stringify({
        tuple_key: { relation, object },
      }),
    });
  }

  // Authorization Models 조회
  async listModels(): Promise<AuthorizationModel[]> {
    const storeId = await this.resolveStoreId();
    const result = await this.fetch<{ authorization_models: AuthorizationModel[] }>(
      `/stores/${storeId}/authorization-models`
    );
    return result.authorization_models || [];
  }

  // Authorization Model 배포 (DSL 문자열로부터)
  async writeModel(modelDsl: string): Promise<{ authorization_model_id: string }> {
    const storeId = await this.resolveStoreId();

    // FGA CLI를 사용하여 DSL을 JSON으로 변환
    const modelJson = await this.transformDslWithCli(modelDsl);

    // 모델 배포
    const result = await this.fetch<{ authorization_model_id: string }>(
      `/stores/${storeId}/authorization-models`,
      {
        method: 'POST',
        body: modelJson,
      }
    );
    return result;
  }

  // FGA CLI를 사용하여 DSL을 JSON으로 변환
  private async transformDslWithCli(dsl: string): Promise<string> {
    const { execSync } = await import('child_process');
    const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    // 임시 파일 생성
    const tempDir = mkdtempSync(join(tmpdir(), 'openfga-'));
    const tempFile = join(tempDir, 'model.fga');

    try {
      writeFileSync(tempFile, dsl, 'utf-8');

      // fga model transform 실행
      const result = execSync(`fga model transform --file "${tempFile}"`, {
        encoding: 'utf-8',
        timeout: 30000,
      });

      return result.trim();
    } finally {
      // 임시 파일 정리
      try {
        unlinkSync(tempFile);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
