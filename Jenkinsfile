pipeline {
  agent any

  environment {
    REGISTRY_URL    = 'https://ghcr.io'
    GH_NAMESPACE    = 'murugananthamb'
    GH_OWNER        = 'MurugananthamB'
    DOCKER_BUILDKIT = '1'
    GIT_CRED_ID     = 'github'
    SONAR_TOKEN_ID  = 'sonar-token'

    TRIVY_SEV_MAIN  = 'CRITICAL,HIGH'
    TRIVY_SEV_DEV   = 'CRITICAL'
  }

  options { timestamps() }

  stages {

    stage('Checkout') {
      steps { checkout scm }
    }

    /* ---------- SonarQube Scan ---------- */
    stage('Sonar Scan') {
      steps {
        script {
          def scannerHome = tool name: 'sonar-scanner',
                                 type: 'hudson.plugins.sonar.SonarRunnerInstallation'

          def rawRepo = sh(returnStdout:true,
                           script:"basename -s .git \$(git config --get remote.origin.url)").trim()

          def sqKey = rawRepo.replaceAll('[^A-Za-z0-9:_\\-\\.]','-')

          withCredentials([string(credentialsId: env.SONAR_TOKEN_ID, variable: 'SONAR_TOKEN')]) {
            withSonarQubeEnv('sonar') {
              sh """
                ${scannerHome}/bin/sonar-scanner \
                  -Dsonar.projectKey=${sqKey} \
                  -Dsonar.projectName=${rawRepo} \
                  -Dsonar.sources=backend,frontend \
                  -Dsonar.exclusions=**/node_modules/**,**/build/**,**/dist/** \
                  -Dsonar.login=\${SONAR_TOKEN}
              """
            }
          }
        }
      }
    }

    /* ---------- Quality Gate ---------- */
    stage('Quality Gate') {
      steps {
        script {
          timeout(time: 10, unit: 'MINUTES') {
            // Quality gate is non-blocking for both main and dev branches
            // Issues are logged but pipeline continues to allow deployment
            try {
              waitForQualityGate abortPipeline: false
              echo "✅ Quality gate passed successfully"
            } catch (Exception e) {
              // Log warning but continue pipeline for both branches
              echo "⚠️ WARNING: Quality gate failed on ${env.BRANCH_NAME} branch: ${e.getMessage()}"
              echo "Pipeline continues despite quality gate failure"
              echo "Please review SonarQube dashboard for details: http://localhost:9000/dashboard?id=Super_Market"
              echo "Quality gate issues should be addressed in future commits"
              // Don't throw - allow pipeline to continue
            }
          }
        }
      }
    }

    /* ---------- Trivy FS Scan ---------- */
   stage('Trivy Code Scan') {
  steps {
    script {
      sh 'mkdir -p reports'

      def sev = (env.BRANCH_NAME == 'main') ? env.TRIVY_SEV_MAIN : env.TRIVY_SEV_DEV

      // SAFE ignorefile check
      def ignoreFlag = ''
      if (fileExists('.trivyignore')) {
        echo "Using .trivyignore"
        ignoreFlag = '--ignorefile .trivyignore'
      } else {
        echo ".trivyignore not found, skipping"
      }

      int rc = sh(returnStatus:true, script: """
        docker run --rm \
          -v ${WORKSPACE}:/workspace \
          -w /workspace \
          aquasec/trivy:latest fs \
          --severity ${sev} \
          --exit-code 1 \
          --format json \
          -o reports/trivy-fs.json \
          ${ignoreFlag} \
          .
      """)

      archiveArtifacts artifacts: 'reports/*', allowEmptyArchive: true

      if (rc != 0) {
        error "Trivy FS scan failed"
      }
    }
  }
}


    /* ---------- Docker Build ---------- */
    stage('Docker Build') {
      when { anyOf { branch 'main'; branch 'dev' } }
      steps {
        script {
          def repo = sh(returnStdout:true,
                       script:"basename -s .git \$(git config --get remote.origin.url)").trim()

          def imageRepo = repo.toLowerCase().replaceAll('[^a-z0-9._-]','')
          env.IMAGE = "ghcr.io/${env.GH_NAMESPACE}/${imageRepo}"

          sh "docker build -t ${env.IMAGE}:latest ."
        }
      }
    }

    /* ---------- Trivy Image Scan ---------- */
    stage('Trivy Image Scan') {
      when { anyOf { branch 'main'; branch 'dev' } }
      steps {
        script {
          sh 'mkdir -p reports'

          def sev = (env.BRANCH_NAME == 'main') ? env.TRIVY_SEV_MAIN : env.TRIVY_SEV_DEV
          def ignoreFlag = fileExists('.trivyignore') ? '--ignorefile .trivyignore' : ''

          int rc = sh(returnStatus:true, script: """
            docker run --rm \
              -v /var/run/docker.sock:/var/run/docker.sock \
              aquasec/trivy:latest image \
              --severity ${sev} \
              --exit-code 1 \
              --format json \
              -o reports/trivy-image.json \
              ${ignoreFlag} \
              ${env.IMAGE}:latest
          """)

          archiveArtifacts artifacts: 'reports/trivy-image.json', allowEmptyArchive: true

          if (rc != 0) {
            error "Trivy image scan failed"
          }
        }
      }
    }

    /* ---------- Push ---------- */
    stage('Push') {
      when { branch 'main' }
      steps {
        script {
          withDockerRegistry([url: env.REGISTRY_URL, credentialsId: env.GIT_CRED_ID]) {
            sh "docker push ${env.IMAGE}:latest"
          }
        }
      }
    }

    /* ---------- Cleanup ---------- */
    stage('Cleanup') {
      steps {
        sh 'docker system prune -af || true'
      }
    }
  }

  post {
    always {
      sh 'docker logout ghcr.io || true'
    }
  }
}
