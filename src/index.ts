#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { OpenFGAClient } from './openfga-client.js';
import { ENVIRONMENTS } from './config.js';

// Tool 정의
const tools: Tool[] = [
  {
    name: 'openfga_store_list',
    description: 'OpenFGA 스토어 목록 조회',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '환경명 (local, int, stage, real)',
          enum: Object.keys(ENVIRONMENTS),
        },
      },
      required: ['env'],
    },
  },
  {
    name: 'openfga_model_read',
    description: 'OpenFGA Authorization Model 조회',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '환경명 (local, int, stage, real)',
          enum: Object.keys(ENVIRONMENTS),
        },
        storeId: {
          type: 'string',
          description: '스토어 ID (생략 시 기본값 사용)',
        },
      },
      required: ['env'],
    },
  },
  {
    name: 'openfga_model_write',
    description: 'OpenFGA Authorization Model 배포 - DSL 파일 경로 또는 DSL 문자열로 모델 배포',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '환경명 (local, int, stage, real)',
          enum: Object.keys(ENVIRONMENTS),
        },
        storeId: {
          type: 'string',
          description: '스토어 ID (생략 시 기본값 사용)',
        },
        filePath: {
          type: 'string',
          description: 'DSL 파일 경로 (예: /path/to/model.fga)',
        },
        dsl: {
          type: 'string',
          description: 'DSL 문자열 (filePath가 없을 때 사용)',
        },
      },
      required: ['env'],
    },
  },
  {
    name: 'openfga_tuple_read',
    description: 'OpenFGA 튜플(권한 관계) 조회',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '환경명 (local, int, stage, real)',
          enum: Object.keys(ENVIRONMENTS),
        },
        storeId: {
          type: 'string',
          description: '스토어 ID (생략 시 기본값 사용)',
        },
        user: {
          type: 'string',
          description: '필터: 사용자 (예: user:john)',
        },
        relation: {
          type: 'string',
          description: '필터: 관계 (예: viewer)',
        },
        object: {
          type: 'string',
          description: '필터: 오브젝트 (예: vehicle:car1)',
        },
      },
      required: ['env'],
    },
  },
  {
    name: 'openfga_tuple_write',
    description: 'OpenFGA 튜플(권한 관계) 생성',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '환경명 (local, int, stage, real)',
          enum: Object.keys(ENVIRONMENTS),
        },
        storeId: {
          type: 'string',
          description: '스토어 ID (생략 시 기본값 사용)',
        },
        user: {
          type: 'string',
          description: '사용자 (예: user:john, company:42dot#member)',
        },
        relation: {
          type: 'string',
          description: '관계 (예: viewer, admin, operator)',
        },
        object: {
          type: 'string',
          description: '오브젝트 (예: vehicle:car1, policy:policy1)',
        },
      },
      required: ['env', 'user', 'relation', 'object'],
    },
  },
  {
    name: 'openfga_tuple_batch_write',
    description: 'OpenFGA 튜플 배치 생성 (여러 개 한번에)',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '환경명 (local, int, stage, real)',
          enum: Object.keys(ENVIRONMENTS),
        },
        storeId: {
          type: 'string',
          description: '스토어 ID (생략 시 기본값 사용)',
        },
        tuples: {
          type: 'array',
          description: '튜플 목록',
          items: {
            type: 'object',
            properties: {
              user: { type: 'string' },
              relation: { type: 'string' },
              object: { type: 'string' },
            },
            required: ['user', 'relation', 'object'],
          },
        },
      },
      required: ['env', 'tuples'],
    },
  },
  {
    name: 'openfga_tuple_delete',
    description: 'OpenFGA 튜플(권한 관계) 삭제',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '환경명 (local, int, stage, real)',
          enum: Object.keys(ENVIRONMENTS),
        },
        storeId: {
          type: 'string',
          description: '스토어 ID (생략 시 기본값 사용)',
        },
        user: {
          type: 'string',
          description: '사용자 (예: user:john)',
        },
        relation: {
          type: 'string',
          description: '관계 (예: viewer)',
        },
        object: {
          type: 'string',
          description: '오브젝트 (예: vehicle:car1)',
        },
      },
      required: ['env', 'user', 'relation', 'object'],
    },
  },
  {
    name: 'openfga_check',
    description: 'OpenFGA 권한 체크 - 사용자가 특정 권한을 가지는지 확인',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '환경명 (local, int, stage, real)',
          enum: Object.keys(ENVIRONMENTS),
        },
        storeId: {
          type: 'string',
          description: '스토어 ID (생략 시 기본값 사용)',
        },
        user: {
          type: 'string',
          description: '사용자 (예: user:john)',
        },
        relation: {
          type: 'string',
          description: '권한/관계 (예: can_view, can_edit)',
        },
        object: {
          type: 'string',
          description: '오브젝트 (예: vehicle:car1)',
        },
      },
      required: ['env', 'user', 'relation', 'object'],
    },
  },
  {
    name: 'openfga_list_objects',
    description: 'OpenFGA 오브젝트 목록 조회 - 사용자가 접근 가능한 오브젝트 목록',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '환경명 (local, int, stage, real)',
          enum: Object.keys(ENVIRONMENTS),
        },
        storeId: {
          type: 'string',
          description: '스토어 ID (생략 시 기본값 사용)',
        },
        user: {
          type: 'string',
          description: '사용자 (예: user:john)',
        },
        relation: {
          type: 'string',
          description: '권한/관계 (예: can_view)',
        },
        type: {
          type: 'string',
          description: '오브젝트 타입 (예: vehicle, policy)',
        },
      },
      required: ['env', 'user', 'relation', 'type'],
    },
  },
  {
    name: 'openfga_expand',
    description: 'OpenFGA 권한 트리 확장 - 특정 오브젝트의 권한 관계 트리 조회',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '환경명 (local, int, stage, real)',
          enum: Object.keys(ENVIRONMENTS),
        },
        storeId: {
          type: 'string',
          description: '스토어 ID (생략 시 기본값 사용)',
        },
        relation: {
          type: 'string',
          description: '권한/관계 (예: can_view, admin)',
        },
        object: {
          type: 'string',
          description: '오브젝트 (예: vehicle:car1)',
        },
      },
      required: ['env', 'relation', 'object'],
    },
  },
];

// MCP Server 생성
const server = new Server(
  {
    name: 'openfga-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool 목록 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Tool 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const env = (args as any).env as string;
    const storeId = (args as any).storeId as string | undefined;
    const client = new OpenFGAClient(env, storeId);

    switch (name) {
      case 'openfga_store_list': {
        const stores = await client.listStores();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stores, null, 2),
            },
          ],
        };
      }

      case 'openfga_model_read': {
        const models = await client.listModels();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(models, null, 2),
            },
          ],
        };
      }

      case 'openfga_model_write': {
        const { filePath, dsl } = args as any;
        let modelDsl: string;

        if (filePath) {
          // 파일에서 DSL 읽기
          modelDsl = readFileSync(filePath, 'utf-8');
        } else if (dsl) {
          modelDsl = dsl;
        } else {
          throw new Error('filePath 또는 dsl 중 하나는 필수입니다');
        }

        const result = await client.writeModel(modelDsl);
        return {
          content: [
            {
              type: 'text',
              text: `모델 배포 완료!\nAuthorization Model ID: ${result.authorization_model_id}\nEnvironment: ${env}`,
            },
          ],
        };
      }

      case 'openfga_tuple_read': {
        const filter: any = {};
        if ((args as any).user) filter.user = (args as any).user;
        if ((args as any).relation) filter.relation = (args as any).relation;
        if ((args as any).object) filter.object = (args as any).object;

        const tuples = await client.readTuples(Object.keys(filter).length > 0 ? filter : undefined);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tuples, null, 2),
            },
          ],
        };
      }

      case 'openfga_tuple_write': {
        const { user, relation, object } = args as any;
        await client.writeTuples([{ user, relation, object }]);
        return {
          content: [
            {
              type: 'text',
              text: `튜플 생성 완료: ${user} -> ${relation} -> ${object}`,
            },
          ],
        };
      }

      case 'openfga_tuple_batch_write': {
        const { tuples } = args as any;
        await client.writeTuples(tuples);
        return {
          content: [
            {
              type: 'text',
              text: `${tuples.length}개 튜플 배치 생성 완료`,
            },
          ],
        };
      }

      case 'openfga_tuple_delete': {
        const { user, relation, object } = args as any;
        await client.deleteTuples([{ user, relation, object }]);
        return {
          content: [
            {
              type: 'text',
              text: `튜플 삭제 완료: ${user} -> ${relation} -> ${object}`,
            },
          ],
        };
      }

      case 'openfga_check': {
        const { user, relation, object } = args as any;
        const result = await client.check(user, relation, object);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                user,
                relation,
                object,
                allowed: result.allowed,
              }, null, 2),
            },
          ],
        };
      }

      case 'openfga_list_objects': {
        const { user, relation, type } = args as any;
        const objects = await client.listObjects(user, relation, type);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ user, relation, type, objects }, null, 2),
            },
          ],
        };
      }

      case 'openfga_expand': {
        const { relation, object } = args as any;
        const result = await client.expand(relation, object);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OpenFGA MCP Server started');
}

main().catch(console.error);
