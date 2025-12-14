// OpenFGA 환경 설정
export interface Environment {
  name: string;
  url: string;
  defaultStoreId?: string;
}

// 환경변수에서 설정 로드
// OPENFGA_ENVIRONMENTS: JSON 형식으로 커스텀 환경 정의 가능
// 예: {"prod": {"url": "https://openfga.example.com", "defaultStoreId": "xxx"}}
function loadEnvironments(): Record<string, Environment> {
  const defaultEnvs: Record<string, Environment> = {
    local: {
      name: 'local',
      url: process.env.OPENFGA_LOCAL_URL || 'http://localhost:8080',
      defaultStoreId: process.env.OPENFGA_LOCAL_STORE_ID,
    },
  };

  // 커스텀 환경 로드
  const customEnvsJson = process.env.OPENFGA_ENVIRONMENTS;
  if (customEnvsJson) {
    try {
      const customEnvs = JSON.parse(customEnvsJson);
      for (const [name, config] of Object.entries(customEnvs)) {
        const envConfig = config as any;
        defaultEnvs[name] = {
          name,
          url: envConfig.url,
          defaultStoreId: envConfig.defaultStoreId,
        };
      }
    } catch (e) {
      console.error('Failed to parse OPENFGA_ENVIRONMENTS:', e);
    }
  }

  // 개별 환경변수로도 설정 가능 (간단한 케이스용)
  // OPENFGA_<ENV>_URL, OPENFGA_<ENV>_STORE_ID
  for (const envName of ['int', 'stage', 'prod', 'real']) {
    const url = process.env[`OPENFGA_${envName.toUpperCase()}_URL`];
    if (url) {
      defaultEnvs[envName] = {
        name: envName,
        url,
        defaultStoreId: process.env[`OPENFGA_${envName.toUpperCase()}_STORE_ID`],
      };
    }
  }

  return defaultEnvs;
}

export const ENVIRONMENTS: Record<string, Environment> = loadEnvironments();

export function getEnvironment(envName: string): Environment {
  const env = ENVIRONMENTS[envName];
  if (!env) {
    const available = Object.keys(ENVIRONMENTS).join(', ');
    throw new Error(`Unknown environment: ${envName}. Available: ${available || 'none (configure via OPENFGA_ENVIRONMENTS or OPENFGA_<ENV>_URL)'}`);
  }
  return env;
}
