{
  description = "three.js dev environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    devShells.${system}.default = pkgs.mkShell {
      packages = with pkgs; [
        nodejs_24
        typescript-language-server
      ];

      shellHook = ''
        echo "node $(node --version) | npm $(npm --version)"
      '';
    };
  };
}
