# Computer Graphics Final Project

이 프로젝트는 Three.js와 Rapier3D 물리 엔진을 사용하여 제작된 3D 환경 탐색 및 상호작용 애플리케이션입니다. GLTF 모델을 이용해 맵을 구성하며, 물리 법칙이 적용된 캐릭터 컨트롤러를 통해 공간을 자유롭게 탐색할 수 있습니다.

## 🛠 기술 스택

- **Rendering**: [Three.js](https://threejs.org/) (WebGL)
- **Physics**: [@dimforge/rapier3d-compat](https://rapier.rs/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Math**: [gl-matrix](https://glmatrix.net/)

## ✨ 주요 기능

- **GLTF 기반 맵 로딩**: `assets/` 디렉토리에 위치한 `.glb` 파일을 로드하여 3D 환경을 구축합니다.
- **물리 엔진 통합**: Rapier3D를 사용하여 맵의 지형과 객체 간의 충돌을 처리합니다.
- **1인칭 캐릭터 컨트롤러**: PointerLockControls를 활용한 시선 전환과 물리 기반 이동(걷기, 점프)을 지원합니다.
- **엔티티 시스템**: 플레이어 및 일반 객체(Cuboid)를 공통 인터페이스로 관리하는 확장 가능한 구조를 갖추고 있습니다.

## 📂 프로젝트 구조

```text
src/
├── entities/           # 게임 내 객체 정의 (Player, Cuboid 등)
├── control.ts          # 키보드 및 마우스 입력 관리
├── gltf.ts             # GLTF 모델 로딩 유틸리티
├── main.ts             # 애플리케이션 진입점 및 렌더 루프
├── map.ts              # 맵 로딩 및 물리 콜라이더 생성
├── state.ts            # 전체 게임 상태(Scene, World, Entities) 관리
└── ...
public/assets/                 # 3D 모델 파일 (.glb)
```

## 🚀 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

## 🎮 조작 방법

- **화면 클릭**: 마우스 커서 잠금 (포커스)
- **W / A / S / D**: 이동
- **Space**: 점프
- **마우스 이동**: 시선 전환
- **ESC**: 마우스 잠금 해제

## 📝 개발 원칙

이 프로젝트는 다음과 같은 원칙을 준수하여 작성되었습니다.
- **모듈화**: 각 기능은 독립적인 모듈로 분리되어 관리됩니다.
- **물리 우선**: 모든 이동과 충돌은 물리 엔진(Rapier3D)을 통해 계산됩니다.
- **확장성**: `Entity` 인터페이스를 통해 새로운 객체를 쉽게 추가할 수 있습니다.

## 주의 사항

모든 리소스는 public 하위 경로에 있어야 합니다.
