package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.jodatime.datetime
import java.net.URL
import java.nio.file.Files
import java.nio.file.Path
import javax.imageio.ImageIO

object UserTable: InitTable("user") {
    val updatedAt = datetime("updated_at").nullable()

    val email = text("email").uniqueIndex()
    val image = text("image")
    val name = text("name")
    val apiKey = text("api_key").index()
}

class User(id: EntityID<String>): SerEntity(id) {
    companion object: ULIDEntityClass<User>(UserTable) {
        override fun new(id: String?, init: User.() -> Unit): User {
            return super.new(id ?: ULID.random()) {
                apiKey = newApiKey()
                init()
            }
        }

        override fun new(init: User.() -> Unit) = new(null, init)

        fun create(
                email: String,
                name: String? = null,
                image: String? = null,
                id: String? = null
        ): User {
            var trueName = name ?: email.split('@')[0]
            val filename = email.sanitizeFilename()?.let {
                "$it.png"
            } ?: randomFile(".png", Db.mediaPath.toString())

            var imageURL = ""
            try {
                if (image != null) {
                    Files.copy(
                            URL(image).openStream(),
                            Path.of(Db.mediaPath.toString(), filename)
                    )
                    imageURL = "/media/$filename"
                }
            } catch (e: Error) {}

            if (imageURL.isEmpty()) {
                ImageIO.write(
                        email.avatar(),
                        "png",
                        Path.of(Db.mediaPath.toString(), filename).toFile()

                )
                imageURL = "/media/$filename"
            }

            if (trueName.isEmpty()) {
                trueName = "Default"
            }

            return new(id) {
                this.name = trueName
                this.email = email
                this.image = imageURL
            }
        }

        fun newApiKey() = random64(32)
    }

    var updatedAt by UserTable.updatedAt

    var email by UserTable.email
    var image by UserTable.image
    var name by UserTable.name
    var apiKey by UserTable.apiKey

    val notes by Note referrersOn NoteTable.userId
    val presets by Preset referrersOn PresetTable.userId
    val tags by Tag referrersOn TagTable.userId

    override fun delete() {
        notes.map { it.delete() }
        presets.map { it.delete() }
        tags.map { it.delete() }
        super.delete()
    }

    override fun serialize() = UserSer(
            id.value,
            email, image, name, apiKey
    )
}

data class UserSer(
        val id: String,
        val email: String,
        val image: String?,
        val name: String,
        val apiKey: String
)

data class UserPartialSer(
        val id: String?,
        val email: String?,
        val image: String?,
        val name: String?,
        val apiKey: String?
)