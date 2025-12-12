package controllers

import java.io.{File, PrintWriter}
import java.nio.file.Files

import controllers.auth.AuthenticationModule
import elastic.ElasticClient
import org.specs2.Specification
import org.specs2.mock.Mockito
import org.specs2.specification.{AfterAll, BeforeEach}
import play.api.inject.bind
import play.api.inject.guice.GuiceApplicationBuilder
import play.api.libs.json.Json
import play.api.test.FakeRequest
import play.api.test.Helpers._

object QueryHintsControllerSpec extends Specification with BeforeEach with AfterAll with Mockito {

  val client = mock[ElasticClient]
  val auth = mock[AuthenticationModule]
  auth.isEnabled returns false

  override def before = {
    org.mockito.Mockito.reset(client)
  }

  // Create temp file for testing filesystem reads
  val tempDir = Files.createTempDirectory("query-hints-test")
  val tempFile = new File(tempDir.toFile, "query-hints.json")
  val validJson = """{"defaultPath": "_search", "sections": [{"name": "Test", "hints": []}]}"""

  def writeTestFile(content: String): Unit = {
    val writer = new PrintWriter(tempFile)
    try {
      writer.write(content)
    } finally {
      writer.close()
    }
  }

  // Application configured to use temp file path
  def applicationWithPath(path: String) = new GuiceApplicationBuilder()
    .configure("query-hints.path" -> path)
    .overrides(
      bind[ElasticClient].toInstance(client),
      bind[AuthenticationModule].toInstance(auth)
    ).build()

  val applicationWithValidFile = {
    writeTestFile(validJson)
    applicationWithPath(tempFile.getAbsolutePath)
  }

  val applicationWithMissingFile = applicationWithPath("/nonexistent/path/query-hints.json")

  override def afterAll() = {
    tempFile.delete()
    tempDir.toFile.delete()
  }

  def is =
    s2"""
    QueryHintsController should
      return JSON from filesystem when file exists           $returnsJsonFromFilesystem
      redirect to bundled assets when file not found         $redirectsWhenFileNotFound
      """

  def returnsJsonFromFilesystem = {
    val response = route(applicationWithValidFile, FakeRequest(GET, "/rest/query-hints")).get
    status(response) mustEqual 200
    contentAsJson(response) mustEqual Json.parse(validJson)
  }

  def redirectsWhenFileNotFound = {
    val response = route(applicationWithMissingFile, FakeRequest(GET, "/rest/query-hints")).get
    status(response) mustEqual 303
    redirectLocation(response) must beSome("/config/query-hints.json")
  }
}
