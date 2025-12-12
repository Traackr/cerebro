package controllers

import javax.inject.Inject
import java.nio.file.{Files, Paths}

import controllers.auth.AuthenticationModule
import play.api.libs.json.Json
import play.api.mvc.InjectedController
import play.api.Configuration

import scala.io.Source
import scala.util.{Try, Using}

class QueryHintsController @Inject()(
    val authentication: AuthenticationModule,
    configuration: Configuration
) extends InjectedController with AuthSupport {

  // Configurable path via config or env var, defaults to /opt/cerebro/public/config/query-hints.json
  private val fileSystemPath: String = configuration
    .getOptional[String]("query-hints.path")
    .getOrElse(sys.env.getOrElse("QUERY_HINTS_PATH", "/opt/cerebro/public/config/query-hints.json"))

  def get = AuthAction(authentication)(defaultExecutionContext) { _ =>
    val path = Paths.get(fileSystemPath)
    if (Files.exists(path) && Files.isReadable(path)) {
      Try {
        Using.resource(Source.fromFile(path.toFile, "UTF-8"))(_.mkString)
      }.toOption
        .map(content => Ok(Json.parse(content)).as("application/json"))
        .getOrElse(InternalServerError(Json.obj("error" -> "Failed to read query hints")))
    } else {
      // Fall back to bundled assets
      Redirect("/config/query-hints.json")
    }
  }
}
