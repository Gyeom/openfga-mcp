# OpenFGA MCP Server

[OpenFGA](https://openfga.dev/)를 위한 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 서버입니다.
Claude Code에서 OpenFGA 권한 관리 작업을 수행할 수 있습니다.

## 기능

- **스토어 관리**: 스토어 목록 조회
- **모델 관리**: Authorization Model 조회/배포
- **튜플 관리**: 권한 관계(튜플) CRUD
- **권한 체크**: Check, ListObjects, Expand

## 설치

```bash
npm install
npm run build
```

## 환경 설정

### 방법 1: JSON 환경변수 (권장)

```bash
export OPENFGA_ENVIRONMENTS='{
  "prod": {
    "url": "https://openfga.example.com",
    "defaultStoreId": "01ABC..."
  },
  "staging": {
    "url": "https://openfga-staging.example.com"
  }
}'
```

### 방법 2: 개별 환경변수

```bash
# 각 환경별로 설정
export OPENFGA_PROD_URL="https://openfga.example.com"
export OPENFGA_PROD_STORE_ID="01ABC..."

export OPENFGA_STAGING_URL="https://openfga-staging.example.com"
```

### 방법 3: 로컬 전용

```bash
# 기본값: http://localhost:8080
export OPENFGA_LOCAL_URL="http://localhost:8080"
export OPENFGA_LOCAL_STORE_ID="01XYZ..."
```

## Claude Code 설정

### 프로젝트별 설정 (`.claude/settings.json`)

```json
{
  "mcpServers": {
    "openfga": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/openfga-mcp/dist/index.js"]
    }
  },
  "env": {
    "OPENFGA_ENVIRONMENTS": "{\"prod\":{\"url\":\"https://openfga.example.com\",\"defaultStoreId\":\"01ABC...\"}}"
  }
}
```

### 글로벌 설정 (`~/.claude.json`)

```json
{
  "mcpServers": {
    "openfga": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/openfga-mcp/dist/index.js"],
      "env": {
        "OPENFGA_ENVIRONMENTS": "{\"prod\":{\"url\":\"https://openfga.example.com\"}}"
      }
    }
  }
}
```

## 사용 가능한 도구

| 도구 | 설명 |
|------|------|
| `openfga_store_list` | 스토어 목록 조회 |
| `openfga_model_read` | Authorization Model 조회 |
| `openfga_model_write` | Authorization Model 배포 (DSL 파일/문자열) |
| `openfga_tuple_read` | 튜플 조회 (필터 지원) |
| `openfga_tuple_write` | 단일 튜플 생성 |
| `openfga_tuple_batch_write` | 여러 튜플 일괄 생성 |
| `openfga_tuple_delete` | 튜플 삭제 |
| `openfga_check` | 권한 체크 |
| `openfga_list_objects` | 접근 가능한 오브젝트 목록 |
| `openfga_expand` | 권한 트리 확장 |

### openfga_model_write

DSL 파일을 OpenFGA에 배포합니다.

**요구사항**: `fga` CLI 설치 필요 ([설치 가이드](https://openfga.dev/docs/getting-started/cli))

```bash
# macOS
brew install openfga/tap/fga

# 기타
go install github.com/openfga/cli/cmd/fga@latest
```

## 사용 예시

```
# 모델 조회
openfga_model_read(env: "prod")

# 모델 배포
openfga_model_write(env: "prod", filePath: "/path/to/model.fga")

# 권한 체크
openfga_check(env: "prod", user: "user:alice", relation: "can_view", object: "document:1")

# 튜플 생성
openfga_tuple_write(env: "prod", user: "user:alice", relation: "viewer", object: "document:1")

# 튜플 배치 생성
openfga_tuple_batch_write(env: "prod", tuples: [
  {user: "user:alice", relation: "viewer", object: "document:1"},
  {user: "user:bob", relation: "editor", object: "document:1"}
])
```

자연어로도 요청 가능:
```
prod 환경에서 user:alice가 document:1을 can_view 할 수 있는지 확인해줘
```

## Hooks 연동 (선택)

모델 배포 후 설정 파일 자동 업데이트 등의 프로젝트별 작업이 필요하면 Claude Code Hook을 사용하세요:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "mcp__openfga__openfga_model_write",
      "hooks": [{
        "type": "command",
        "command": "./scripts/post-model-deploy.sh"
      }]
    }]
  }
}
```

Hook 스크립트는 stdin으로 JSON을 받습니다:
```json
{
  "tool_name": "mcp__openfga__openfga_model_write",
  "tool_output": "모델 배포 완료!\nAuthorization Model ID: 01ABC...\nEnvironment: prod"
}
```

## 개발

```bash
# 소스 수정 후 빌드
npm run build

# 개발 모드 (watch)
npm run dev
```

## 라이선스

MIT
